"""Real-time IoT simulation engine generating realistic telemetry, running real ML inference,
persisting to MongoDB, and broadcasting events via WebSockets.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import math
import time
from typing import Any, Dict, List, Optional
import uuid

import numpy as np
import pandas as pd

from app.core.logging import setup_logging
from app.repositories.mongo_repo import MongoRepository
from app.schemas.api_v1 import (
    AnomalyInjectionConfig,
    SimulatorMetrics,
    SimulatorStartRequest,
    SimulatorStatusResponse,
)
from app.services.model_service import ModelRegistryService
from app.websocket.manager import ws_manager

logger = setup_logging()


class VirtualSensorDevice:
    """Simulates an individual virtual IoT sensor node with realistic physics and state."""

    def __init__(
        self,
        device_id: str,
        seed: int = 42,
        channels: Optional[Dict[str, Dict[str, float]]] = None,
    ):
        self.device_id = device_id
        self.rng = np.random.default_rng(seed)
        self.step_idx = 0

        # Physical channel baseline specifications
        self.channels = channels or {
            "temperature": {"baseline": 45.0, "amplitude": 5.0, "noise": 0.4, "min": -10.0, "max": 120.0},
            "humidity": {"baseline": 55.0, "amplitude": -8.0, "noise": 1.0, "min": 0.0, "max": 100.0},
            "pressure": {"baseline": 101.3, "amplitude": 1.2, "noise": 0.2, "min": 50.0, "max": 200.0},
            "vibration": {"baseline": 1.2, "amplitude": 0.2, "noise": 0.08, "min": 0.0, "max": 25.0},
            "current": {"baseline": 12.5, "amplitude": 1.5, "noise": 0.25, "min": 0.0, "max": 50.0},
        }

        # Dynamic physical state
        self.phase_shift = self.rng.uniform(0, 2 * math.pi)
        self.last_values = {k: v["baseline"] for k, v in self.channels.items()}

    def generate_step(
        self,
        timestamp: datetime,
        active_injections: List[AnomalyInjectionConfig],
    ) -> Dict[str, float]:
        """Generate one multivariate telemetry sample for the current step."""
        t_seconds = self.step_idx * 1.0
        features: Dict[str, float] = {}

        for ch, spec in self.channels.items():
            # Diurnal / cyclical periodic component
            cycle = spec["amplitude"] * math.sin((2 * math.pi * t_seconds / 3600.0) + self.phase_shift)
            noise = float(self.rng.normal(0, spec["noise"]))
            val = spec["baseline"] + cycle + noise

            # Apply active anomaly injections
            for inj in active_injections:
                if ch in inj.target_channels:
                    if inj.anomaly_type == "spike":
                        val += inj.magnitude * (spec["amplitude"] if spec["amplitude"] != 0 else 5.0)
                    elif inj.anomaly_type == "drift":
                        offset_step = self.step_idx - inj.start_step
                        val += (inj.magnitude * 0.5) * offset_step
                    elif inj.anomaly_type == "noise":
                        val += float(self.rng.normal(0, spec["noise"] * inj.magnitude * 3))
                    elif inj.anomaly_type == "freeze":
                        val = self.last_values[ch]
                    elif inj.anomaly_type == "regime_shift":
                        val += inj.magnitude * 10.0

            # Physical clamping
            val = max(spec["min"], min(spec["max"], val))
            features[ch] = round(val, 4)
            self.last_values[ch] = val

        self.step_idx += 1
        return features


class SimulationEngine:
    """Coordinates multi-device telemetry generation, real ML inference,
    database persistence, latency profiling, and WebSocket broadcasting.
    """

    def __init__(self, repo_factory=None):
        self.repo_factory = repo_factory
        self.status = "stopped"  # stopped, running, paused
        self.simulation_id: Optional[str] = None
        self.config: Optional[SimulatorStartRequest] = None
        self.devices: Dict[str, VirtualSensorDevice] = {}
        self.task: Optional[asyncio.Task] = None
        self._pause_event = asyncio.Event()
        self._pause_event.set()  # Unpaused initially

        self.start_time: Optional[float] = None
        self.metrics = SimulatorMetrics()
        self.latency_samples: List[float] = []
        self.max_queue_size = 500
        self._step_counter = 0

    def is_running(self) -> bool:
        return self.status in ("running", "paused")

    async def start(self, config: SimulatorStartRequest, repo: Optional[MongoRepository] = None) -> str:
        """Start a new simulation session. Prevents duplicate tasks."""
        if self.is_running():
            raise RuntimeError(f"Simulation is already active (status={self.status}, id={self.simulation_id}). Stop or reset it first.")

        self.simulation_id = f"SIM_{uuid.uuid4().hex[:10]}"
        self.config = config
        self.status = "running"
        self._pause_event.set()
        self.start_time = time.time()
        self.metrics = SimulatorMetrics()
        self.latency_samples = []
        self._step_counter = 0

        # Initialize devices with independent seeds
        self.devices = {}
        for idx, dev_id in enumerate(config.devices):
            dev_seed = config.random_seed + (idx * 101)
            self.devices[dev_id] = VirtualSensorDevice(device_id=dev_id, seed=dev_seed)

        # Launch background loop task
        self.task = asyncio.create_task(self._simulation_loop(repo))
        logger.info("Simulation %s started with %d devices.", self.simulation_id, len(self.devices))

        # Broadcast status event
        await ws_manager.broadcast({
            "event_type": "simulation_status",
            "simulation_id": self.simulation_id,
            "status": "running",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "devices": config.devices,
        })

        return self.simulation_id

    async def pause(self) -> None:
        """Pause telemetry generation without terminating session."""
        if self.status != "running":
            raise RuntimeError(f"Cannot pause simulation in state: {self.status}")
        self.status = "paused"
        self._pause_event.clear()
        logger.info("Simulation %s paused.", self.simulation_id)
        await ws_manager.broadcast({
            "event_type": "simulation_status",
            "simulation_id": self.simulation_id,
            "status": "paused",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

    async def resume(self) -> None:
        """Resume paused simulation session."""
        if self.status != "paused":
            raise RuntimeError(f"Cannot resume simulation in state: {self.status}")
        self.status = "running"
        self._pause_event.set()
        logger.info("Simulation %s resumed.", self.simulation_id)
        await ws_manager.broadcast({
            "event_type": "simulation_status",
            "simulation_id": self.simulation_id,
            "status": "running",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

    async def stop(self) -> None:
        """Stop and terminate simulation session."""
        if not self.is_running():
            return

        self.status = "stopped"
        self._pause_event.set()  # Unblock loop if paused so it exits

        if self.task and not self.task.done():
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass

        logger.info("Simulation %s stopped.", self.simulation_id)
        await ws_manager.broadcast({
            "event_type": "simulation_status",
            "simulation_id": self.simulation_id,
            "status": "stopped",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

    async def reset(self) -> None:
        """Reset simulator state completely."""
        await self.stop()
        self.simulation_id = None
        self.config = None
        self.devices = {}
        self.metrics = SimulatorMetrics()
        self.latency_samples = []
        self._step_counter = 0

    def get_status(self) -> SimulatorStatusResponse:
        """Retrieve current status and real-time execution metrics."""
        uptime = 0.0
        throughput = 0.0
        if self.start_time and self.status in ("running", "paused"):
            uptime = max(0.0, time.time() - self.start_time)
            if uptime > 0:
                throughput = round(self.metrics.generated_count / uptime, 2)

        avg_lat = 0.0
        if self.latency_samples:
            avg_lat = round(float(np.mean(self.latency_samples[-100:])), 2)

        self.metrics.avg_latency_ms = avg_lat
        self.metrics.throughput_rps = throughput

        return SimulatorStatusResponse(
            simulation_id=self.simulation_id,
            status=self.status,
            devices=list(self.devices.keys()) if self.devices else [],
            model_name=self.config.model_name if self.config else None,
            sampling_rate_hz=self.config.sampling_rate_hz if self.config else 1.0,
            playback_speed=self.config.playback_speed if self.config else 1.0,
            uptime_seconds=round(uptime, 2),
            connected_ws_clients=ws_manager.connection_count(),
            metrics=self.metrics,
            created_at=datetime.fromtimestamp(self.start_time, tz=timezone.utc) if self.start_time else None,
        )

    async def _simulation_loop(self, repo: Optional[MongoRepository] = None) -> None:
        """Internal asynchronous generation loop."""
        try:
            assert self.config is not None
            # Calculate sleep interval based on sampling rate and playback speed
            # Effective interval = (1.0 / sampling_rate_hz) / playback_speed
            base_interval = 1.0 / max(0.1, self.config.sampling_rate_hz)
            sleep_interval = max(0.01, base_interval / max(0.1, self.config.playback_speed))

            while self.status == "running" or self.status == "paused":
                # Wait if simulation is paused
                await self._pause_event.wait()
                if self.status != "running":
                    break

                step_start_time = time.perf_counter()
                now_utc = datetime.now(timezone.utc)

                # Determine active anomaly injections for current step
                active_injections = [
                    inj for inj in self.config.anomaly_injections
                    if inj.start_step <= self._step_counter < (inj.start_step + inj.duration_steps)
                ]

                # Step each virtual device
                for device_id, device in self.devices.items():
                    features = device.generate_step(now_utc, active_injections)
                    self.metrics.generated_count += 1

                    # 1. Real ML Model Inference
                    inf_start = time.perf_counter()
                    try:
                        inf_result = ModelRegistryService.run_inference(
                            features=features,
                            model_name=self.config.model_name,
                        )
                        self.metrics.inferred_count += 1
                        is_anom = inf_result["is_anomaly"]
                        if is_anom:
                            self.metrics.anomalies_detected += 1
                    except Exception as e:
                        logger.error("Inference failed during simulation: %s", e)
                        inf_result = {
                            "model_name": self.config.model_name,
                            "normalized_score": 0.0,
                            "decision_threshold": 0.5,
                            "is_anomaly": False,
                            "top_contributing_features": [],
                        }

                    # Measure latency
                    step_latency_ms = (time.perf_counter() - inf_start) * 1000.0
                    self.latency_samples.append(step_latency_ms)

                    # 2. Database Persistence
                    reading_doc = {
                        "reading_id": f"SIM_READ_{uuid.uuid4().hex[:10]}",
                        "device_id": device_id,
                        "dataset_id": f"sim_{self.simulation_id}",
                        "timestamp": now_utc,
                        "features": features,
                    }

                    if repo and self.config.persist_to_db:
                        try:
                            await repo.insert_sensor_readings([reading_doc])
                            self.metrics.persisted_count += 1

                            if inf_result["is_anomaly"]:
                                anomaly_doc = {
                                    "anomaly_id": f"SIM_ANOM_{uuid.uuid4().hex[:10]}",
                                    "reading_id": reading_doc["reading_id"],
                                    "device_id": device_id,
                                    "timestamp": now_utc,
                                    "model_name": inf_result["model_name"],
                                    "model_version": inf_result.get("model_version", "v1.0"),
                                    "raw_score": inf_result.get("raw_score", 0.0),
                                    "normalized_score": inf_result["normalized_score"],
                                    "threshold": inf_result["decision_threshold"],
                                    "severity": inf_result.get("severity", "HIGH"),
                                    "review_status": "pending",
                                    "affected_features": [f["feature"] for f in inf_result["top_contributing_features"]],
                                    "explanation": inf_result.get("explanation", ""),
                                    "created_at": now_utc,
                                }
                                await repo.insert_anomaly(anomaly_doc)
                        except Exception as e:
                            logger.warning("DB persistence error in simulation: %s", e)
                            self.metrics.dropped_messages += 1

                    # 3. WebSocket Real-Time Broadcast
                    telemetry_event = {
                        "event_type": "telemetry",
                        "simulation_id": self.simulation_id,
                        "timestamp": now_utc.isoformat(),
                        "device_id": device_id,
                        "features": features,
                        "prediction": {
                            "model_name": inf_result["model_name"],
                            "normalized_score": inf_result["normalized_score"],
                            "threshold": inf_result["decision_threshold"],
                            "is_anomaly": inf_result["is_anomaly"],
                            "top_contributing_features": inf_result["top_contributing_features"],
                        },
                    }
                    await ws_manager.broadcast(telemetry_event)

                    if inf_result["is_anomaly"]:
                        anomaly_event = {
                            "event_type": "anomaly_alert",
                            "simulation_id": self.simulation_id,
                            "timestamp": now_utc.isoformat(),
                            "device_id": device_id,
                            "score": inf_result["normalized_score"],
                            "threshold": inf_result["decision_threshold"],
                            "affected_features": [f["feature"] for f in inf_result["top_contributing_features"]],
                        }
                        await ws_manager.broadcast(anomaly_event)

                self._step_counter += 1

                # Heartbeat broadcast every 10 steps
                if self._step_counter % 10 == 0:
                    hb_event = {
                        "event_type": "heartbeat",
                        "simulation_id": self.simulation_id,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "step": self._step_counter,
                        "clients": ws_manager.connection_count(),
                    }
                    await ws_manager.broadcast(hb_event)

                # Elapsed time compensation for accurate frequency
                elapsed = time.perf_counter() - step_start_time
                delay = max(0.001, sleep_interval - elapsed)
                await asyncio.sleep(delay)

        except asyncio.CancelledError:
            logger.info("Simulation loop cancelled gracefully.")
        except Exception as e:
            logger.exception("Unexpected error in simulation loop: %s", e)
            self.status = "error"
            await ws_manager.broadcast({
                "event_type": "simulation_status",
                "simulation_id": self.simulation_id,
                "status": "error",
                "error": str(e),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })


# Global singleton simulation engine
sim_engine = SimulationEngine()
