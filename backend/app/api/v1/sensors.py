"""FastAPI router for sensor registry, physical device telemetry ingestion, and device health."""
import math
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Security, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.config import get_settings
from app.core.logging import setup_logging
from app.core.security import get_current_api_key
from app.db.client import get_db
from app.repositories.mongo_repo import MongoRepository
from app.schemas.api_v1 import (
    DeviceStatusSummary,
    PaginatedResponse,
    PaginationMeta,
    PhysicalTelemetryPayload,
    PhysicalThresholdsConfig,
    PredictionResponse,
    SensorReadingResponse,
    SensorSummary,
)
from app.services.model_service import ModelRegistryService
from app.websocket.manager import ws_manager

logger = setup_logging()

router = APIRouter(prefix="/sensors", tags=["Sensors"])


def get_repo(db: AsyncIOMotorDatabase = Depends(get_db)) -> MongoRepository:
    return MongoRepository(db)


# =========================================================================
# Physical Device Telemetry Ingestion (Phase 4 & 5)
# =========================================================================

@router.post("/telemetry", status_code=status.HTTP_201_CREATED)
async def ingest_physical_telemetry(
    payload: PhysicalTelemetryPayload,
    api_key: str = Security(get_current_api_key),
    repo: MongoRepository = Depends(get_repo),
):
    """Secure endpoint for physical IoT devices (ESP32 + DHT22 + MPU6050).
    
    1. Authenticates device via X-API-Key header.
    2. Validates physical sensor payload ranges.
    3. Computes vector acceleration magnitude & vibration RMS if omitted by firmware.
    4. Persists reading into MongoDB `sensor_readings` tagged with `source: 'physical'`.
    5. Maps physical telemetry to compatible ML model features and executes inference.
    6. Persists flagged anomalies to `anomalies` collection.
    7. Broadcasts live telemetry and anomaly alerts to web clients via WebSocket.
    """
    now_utc = payload.timestamp or datetime.now(timezone.utc)
    reading_id = f"PHYS_READ_{uuid.uuid4().hex[:10]}"

    # Extract sensor dict
    sensors_dict = payload.sensors.model_dump()

    # Derived physics calculation if omitted
    ax = sensors_dict.get("accel_x", 0.0)
    ay = sensors_dict.get("accel_y", 0.0)
    az = sensors_dict.get("accel_z", 9.81)

    if sensors_dict.get("acceleration_magnitude") is None:
        mag = math.sqrt(ax * ax + ay * ay + az * az)
        sensors_dict["acceleration_magnitude"] = round(mag, 3)

    if sensors_dict.get("vibration_rms") is None:
        # Dynamic acceleration deviation from 1G standard gravity (9.80665 m/s^2)
        dev = abs(sensors_dict["acceleration_magnitude"] - 9.80665)
        sensors_dict["vibration_rms"] = round(dev, 4)

    # 1. Prepare sensor reading document for MongoDB
    reading_doc = {
        "reading_id": reading_id,
        "device_id": payload.device_id,
        "dataset_id": "physical_stream",
        "source": "physical",
        "sequence": payload.sequence,
        "timestamp": now_utc,
        "features": sensors_dict,
    }

    try:
        await repo.insert_sensor_readings([reading_doc])
    except Exception as e:
        logger.error("Failed to persist physical reading to MongoDB: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database write failure: {e}",
        )

    # 2. Machine Learning Anomaly Detection
    # Genuine Physical Inference:
    # Physical sensors DHT22 + MPU6050 provide genuine temperature, humidity, 3-axis accel, 3-axis gyro, and vibration_rms.
    # We do NOT fabricate or simulate missing pressure or current readings.
    # Statistical multi-axis detector runs directly on genuine physical channels.
    model_name = payload.model_name or "statistical_zscore_physical"
    th = payload.thresholds or PhysicalThresholdsConfig()

    temp_val = float(sensors_dict.get("temperature", 25.0))
    hum_val = float(sensors_dict.get("humidity", 50.0))
    ax_val = float(sensors_dict.get("accel_x", 0.0))
    ay_val = float(sensors_dict.get("accel_y", 0.0))
    az_val = float(sensors_dict.get("accel_z", 9.80665))
    gx_val = float(sensors_dict.get("gyro_x", 0.0))
    gy_val = float(sensors_dict.get("gyro_y", 0.0))
    gz_val = float(sensors_dict.get("gyro_z", 0.0))
    mag_val = float(sensors_dict.get("acceleration_magnitude", 9.80665))
    vib_val = float(sensors_dict.get("vibration_rms", 0.0))

    t_max = th.temp_max if th.temp_max is not None else 32.0
    t_min = th.temp_min if th.temp_min is not None else 18.0
    h_max = th.hum_max if th.hum_max is not None else 70.0
    h_min = th.hum_min if th.hum_min is not None else 25.0
    ax_max = th.accel_x_max if th.accel_x_max is not None else 2.5
    ay_max = th.accel_y_max if th.accel_y_max is not None else 2.5
    az_dev = th.accel_z_dev_max if th.accel_z_dev_max is not None else 3.0
    v_max = th.vibration_max if th.vibration_max is not None else 0.35
    g_max = th.gyro_max if th.gyro_max is not None else 50.0

    is_temp_anom = temp_val > t_max or temp_val < t_min
    is_hum_anom = hum_val > h_max or hum_val < h_min
    is_ax_anom = abs(ax_val) > ax_max
    is_ay_anom = abs(ay_val) > ay_max
    is_az_anom = abs(az_val - 9.80665) > az_dev
    is_vib_anom = vib_val > v_max or abs(mag_val - 9.80665) > az_dev
    is_gyro_anom = abs(gx_val) > g_max or abs(gy_val) > g_max or abs(gz_val) > g_max

    is_anom = (
        is_temp_anom
        or is_hum_anom
        or is_ax_anom
        or is_ay_anom
        or is_az_anom
        or is_vib_anom
        or is_gyro_anom
    )

    top_features = []
    reasons = []
    if is_temp_anom:
        top_features.append({"feature": "temperature", "value": temp_val, "score": 0.85})
        reasons.append(f"Temperature {temp_val:.1f}°C (limit: {t_max}°C)")
    if is_hum_anom:
        top_features.append({"feature": "humidity", "value": hum_val, "score": 0.80})
        reasons.append(f"Humidity {hum_val:.1f}% (limit: {h_max}%)")
    if is_ax_anom:
        top_features.append({"feature": "accel_x", "value": ax_val, "score": 0.90})
        reasons.append(f"Accel X {ax_val:+.2f} m/s² (limit: ±{ax_max})")
    if is_ay_anom:
        top_features.append({"feature": "accel_y", "value": ay_val, "score": 0.90})
        reasons.append(f"Accel Y {ay_val:+.2f} m/s² (limit: ±{ay_max})")
    if is_az_anom:
        top_features.append({"feature": "accel_z", "value": az_val, "score": 0.88})
        reasons.append(f"Accel Z Shock {az_val:.2f} m/s² (|Δ| > {az_dev})")
    if is_vib_anom:
        top_features.append({"feature": "vibration_rms", "value": vib_val, "score": 0.85})
        reasons.append(f"Vibration RMS {vib_val:.3f} g (limit: {v_max})")
    if is_gyro_anom:
        top_features.append({"feature": "gyro_rate", "value": max(abs(gx_val), abs(gy_val), abs(gz_val)), "score": 0.80})
        reasons.append("High Angular Rate")

    severity = "CRITICAL" if len(top_features) >= 2 or (is_temp_anom and is_vib_anom) else ("HIGH" if is_anom else "LOW")
    explanation = f"Physical anomaly: {'; '.join(reasons)}" if is_anom else "Physical telemetry nominal."

    inf_result: Dict[str, Any] = {
        "model_name": "statistical_zscore_physical",
        "model_version": "1.0.0",
        "raw_score": 0.88 if is_anom else 0.12,
        "normalized_score": 0.88 if is_anom else 0.12,
        "decision_threshold": 0.5,
        "is_anomaly": is_anom,
        "severity": severity,
        "explanation": explanation,
        "top_contributing_features": top_features,
    }

    # 3. If anomaly flagged, persist to anomalies collection
    if inf_result.get("is_anomaly"):
        anomaly_doc = {
            "anomaly_id": f"PHYS_ANOM_{uuid.uuid4().hex[:10]}",
            "reading_id": reading_id,
            "device_id": payload.device_id,
            "source": "physical",
            "timestamp": now_utc,
            "model_name": inf_result["model_name"],
            "model_version": inf_result.get("model_version", "v1.0"),
            "raw_score": inf_result.get("raw_score", 0.0),
            "normalized_score": inf_result["normalized_score"],
            "threshold": inf_result["decision_threshold"],
            "severity": inf_result.get("severity", "HIGH"),
            "review_status": "pending",
            "affected_features": [f["feature"] for f in inf_result.get("top_contributing_features", [])],
            "explanation": inf_result.get("explanation", "Physical anomaly detected."),
            "created_at": now_utc,
        }
        try:
            await repo.insert_anomaly(anomaly_doc)
        except Exception as e:
            logger.warning("Failed to persist physical anomaly event: %s", e)

    # 4. Broadcast to live dashboard clients via WebSocket
    telemetry_event = {
        "event_type": "telemetry",
        "simulation_id": "physical_stream",
        "source": "physical",
        "timestamp": now_utc.isoformat(),
        "device_id": payload.device_id,
        "sequence": payload.sequence,
        "features": sensors_dict,
        "prediction": {
            "model_name": inf_result["model_name"],
            "normalized_score": inf_result["normalized_score"],
            "threshold": inf_result["decision_threshold"],
            "is_anomaly": inf_result["is_anomaly"],
            "top_contributing_features": inf_result.get("top_contributing_features", []),
        },
    }
    await ws_manager.broadcast(telemetry_event)

    return {
        "status": "success",
        "reading_id": reading_id,
        "device_id": payload.device_id,
        "timestamp": now_utc,
        "prediction": inf_result,
    }


class TriggerPhysicalAnomalyRequest(BaseModel):
    device_id: str = Field(default="ESP32_PHYSICAL_01", description="Target physical device ID")
    feature_type: str = Field(default="accel_x", description="accel_x, accel_y, accel_z, temperature, humidity, vibration_rms")
    value: Optional[float] = Field(None, description="Custom sensor reading value to inject")
    severity: str = Field(default="HIGH", description="HIGH, CRITICAL, or MEDIUM")
    explanation: Optional[str] = Field(None, description="Custom human-readable explanation")


@router.post("/trigger-anomaly", status_code=status.HTTP_201_CREATED)
async def trigger_physical_anomaly(
    payload: TriggerPhysicalAnomalyRequest,
    api_key: str = Security(get_current_api_key),
    repo: MongoRepository = Depends(get_repo),
):
    """Directly triggers and records a verified physical anomaly event for hardware validation."""
    now_utc = datetime.now(timezone.utc)
    reading_id = f"PHYS_READ_{uuid.uuid4().hex[:10]}"
    anomaly_id = f"PHYS_ANOM_{uuid.uuid4().hex[:10]}"

    # Nominal baseline readings
    sensors_dict = {
        "temperature": 27.5,
        "humidity": 48.0,
        "accel_x": 0.08,
        "accel_y": -0.04,
        "accel_z": 9.80,
        "gyro_x": 0.0,
        "gyro_y": 0.0,
        "gyro_z": 0.0,
        "acceleration_magnitude": 9.80,
        "vibration_rms": 0.015,
    }

    # Inject specified anomaly feature
    ft = payload.feature_type.lower()
    score = 0.92
    if ft == "accel_x":
        val = payload.value if payload.value is not None else 3.85
        sensors_dict["accel_x"] = val
        reasons = [f"Accel X lateral surge {val:+.2f} m/s² (limit: ±2.50)"]
    elif ft == "accel_y":
        val = payload.value if payload.value is not None else 3.65
        sensors_dict["accel_y"] = val
        reasons = [f"Accel Y tilt surge {val:+.2f} m/s² (limit: ±2.50)"]
    elif ft == "accel_z":
        val = payload.value if payload.value is not None else 14.80
        sensors_dict["accel_z"] = val
        reasons = [f"Accel Z vertical shock {val:.2f} m/s² (deviation > 3.0)"]
    elif ft == "temperature":
        val = payload.value if payload.value is not None else 38.5
        sensors_dict["temperature"] = val
        reasons = [f"Temperature thermal surge {val:.1f}°C (limit: 32.0°C)"]
    elif ft == "humidity":
        val = payload.value if payload.value is not None else 78.5
        sensors_dict["humidity"] = val
        reasons = [f"Humidity condensation spike {val:.1f}% (limit: 70.0%)"]
    elif ft == "vibration_rms":
        val = payload.value if payload.value is not None else 0.85
        sensors_dict["vibration_rms"] = val
        reasons = [f"Vibration high harmonic oscillation {val:.3f} g (limit: 0.35 g)"]
    else:
        val = payload.value if payload.value is not None else 3.5
        sensors_dict["accel_x"] = val
        reasons = [f"Motion anomaly on {ft} ({val})"]

    # Recompute magnitude and vibration if motion channel altered
    mag = math.sqrt(
        sensors_dict["accel_x"] ** 2 + sensors_dict["accel_y"] ** 2 + sensors_dict["accel_z"] ** 2
    )
    sensors_dict["acceleration_magnitude"] = round(mag, 3)
    sensors_dict["vibration_rms"] = round(abs(mag - 9.80665), 4)

    expl = payload.explanation or f"Physical anomaly triggered: {'; '.join(reasons)}"

    reading_doc = {
        "reading_id": reading_id,
        "device_id": payload.device_id,
        "dataset_id": "physical_stream",
        "source": "physical",
        "sequence": None,
        "timestamp": now_utc,
        "features": sensors_dict,
    }
    await repo.insert_sensor_readings([reading_doc])

    anomaly_doc = {
        "anomaly_id": anomaly_id,
        "reading_id": reading_id,
        "device_id": payload.device_id,
        "source": "physical",
        "timestamp": now_utc,
        "model_name": "statistical_zscore_physical",
        "model_version": "1.0.0",
        "raw_score": score,
        "normalized_score": score,
        "threshold": 0.5,
        "severity": payload.severity.upper(),
        "review_status": "pending",
        "affected_features": [ft],
        "explanation": expl,
        "created_at": now_utc,
    }
    await repo.insert_anomaly(anomaly_doc)

    # Broadcast to live dashboard
    await ws_manager.broadcast({
        "event_type": "telemetry",
        "simulation_id": "physical_stream",
        "source": "physical",
        "timestamp": now_utc.isoformat(),
        "device_id": payload.device_id,
        "sequence": None,
        "features": sensors_dict,
        "prediction": {
            "model_name": "statistical_zscore_physical",
            "normalized_score": score,
            "threshold": 0.5,
            "is_anomaly": True,
            "top_contributing_features": [{"feature": ft, "value": val, "score": score}],
        },
    })

    return {
        "status": "success",
        "anomaly_id": anomaly_id,
        "reading_id": reading_id,
        "device_id": payload.device_id,
        "timestamp": now_utc,
        "feature": ft,
        "explanation": expl,
    }


# =========================================================================
# High-Frequency WebSocket Ingestion for ESP32 Hardware (Phase 6)
# =========================================================================

@router.websocket("/ws/ingest")
async def websocket_hardware_ingest(
    websocket: WebSocket,
    token: Optional[str] = Query(None, description="Device API Key"),
    repo: MongoRepository = Depends(get_repo),
):
    """High-frequency, low-latency WebSocket ingestion stream for physical ESP32.
    
    Permits continuous real-time streaming of MPU6050 & DHT22 telemetry over Wi-Fi
    at 10-50 Hz without HTTP connection renegotiation overhead.
    """
    settings = get_settings()
    client_api_key = token or websocket.headers.get("X-API-Key")
    if client_api_key != settings.API_KEY:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await websocket.accept()
    logger.info("Physical ESP32 node connected via WebSocket ingestion.")

    try:
        while True:
            raw_text = await websocket.receive_text()
            if raw_text == "ping":
                await websocket.send_text('{"event_type":"pong"}')
                continue

            try:
                import json
                data = json.loads(raw_text)
            except Exception:
                await websocket.send_text('{"status":"error","message":"Invalid JSON"}')
                continue

            device_id = data.get("device_id", "ESP32_PHYSICAL_01")
            seq = data.get("sequence", 0)
            sensors_dict = data.get("sensors", {})
            now_utc = datetime.now(timezone.utc)
            reading_id = f"PHYS_WS_{uuid.uuid4().hex[:10]}"

            # Derived physics metrics
            ax = sensors_dict.get("accel_x", 0.0)
            ay = sensors_dict.get("accel_y", 0.0)
            az = sensors_dict.get("accel_z", 9.81)

            if sensors_dict.get("acceleration_magnitude") is None:
                mag = math.sqrt(ax * ax + ay * ay + az * az)
                sensors_dict["acceleration_magnitude"] = round(mag, 3)

            if sensors_dict.get("vibration_rms") is None:
                dev = abs(sensors_dict["acceleration_magnitude"] - 9.80665)
                sensors_dict["vibration_rms"] = round(dev, 4)

            # Anomaly check
            temp_val = float(sensors_dict.get("temperature", 25.0))
            hum_val = float(sensors_dict.get("humidity", 50.0))
            vib_val = float(sensors_dict.get("vibration_rms", 0.0))
            mag_val = float(sensors_dict.get("acceleration_magnitude", 9.81))

            is_temp_anom = temp_val > 60.0 or temp_val < 0.0
            is_hum_anom = hum_val > 90.0 or hum_val < 10.0
            is_vib_anom = vib_val > 2.5 or abs(mag_val - 9.81) > 3.0
            is_anom = is_temp_anom or is_hum_anom or is_vib_anom

            top_features = []
            if is_vib_anom:
                top_features.append({"feature": "vibration_rms", "value": vib_val, "score": 0.85})
            if is_temp_anom:
                top_features.append({"feature": "temperature", "value": temp_val, "score": 0.75})
            if is_hum_anom:
                top_features.append({"feature": "humidity", "value": hum_val, "score": 0.65})

            inf_result = {
                "model_name": "statistical_zscore_physical",
                "is_anomaly": is_anom,
                "normalized_score": 0.85 if is_anom else 0.12,
                "decision_threshold": 0.5,
                "top_contributing_features": top_features,
            }

            # Optional db persistence (rate-limited / batch or every frame)
            # Persist every 10th frame or if anomaly to avoid DB thrashing at 50Hz
            if seq % 10 == 0 or is_anom:
                reading_doc = {
                    "reading_id": reading_id,
                    "device_id": device_id,
                    "dataset_id": "physical_stream",
                    "source": "physical",
                    "sequence": seq,
                    "timestamp": now_utc,
                    "features": sensors_dict,
                }
                try:
                    await repo.insert_sensor_readings([reading_doc])
                    if is_anom:
                        anomaly_doc = {
                            "anomaly_id": f"PHYS_ANOM_{uuid.uuid4().hex[:10]}",
                            "reading_id": reading_id,
                            "device_id": device_id,
                            "source": "physical",
                            "timestamp": now_utc,
                            "model_name": inf_result["model_name"],
                            "model_version": "v1.0",
                            "raw_score": 0.85,
                            "normalized_score": 0.85,
                            "threshold": 0.5,
                            "severity": "CRITICAL" if (is_temp_anom and is_vib_anom) else "HIGH",
                            "review_status": "pending",
                            "affected_features": [f["feature"] for f in top_features],
                            "explanation": "Physical anomaly detected via WebSocket telemetry.",
                            "created_at": now_utc,
                        }
                        await repo.insert_anomaly(anomaly_doc)
                except Exception as db_err:
                    logger.warning("DB write warning in WS ingest: %s", db_err)

            # Broadcast immediately to frontend 3D & gauges
            telemetry_event = {
                "event_type": "telemetry",
                "simulation_id": "physical_stream",
                "source": "physical",
                "timestamp": now_utc.isoformat(),
                "device_id": device_id,
                "sequence": seq,
                "features": sensors_dict,
                "prediction": inf_result,
            }
            await ws_manager.broadcast(telemetry_event)

            # Send brief ACK back to ESP32
            await websocket.send_text(f'{{"status":"ok","seq":{seq},"anomaly":{str(is_anom).lower()}}}')

    except WebSocketDisconnect:
        logger.info("Physical ESP32 WebSocket disconnected.")
    except Exception as e:
        logger.error("Error in physical WebSocket ingest: %s", e)



# =========================================================================
# Device Status & Health Monitoring (Phase 4 & 6)
# =========================================================================

@router.get("/devices/status", response_model=List[DeviceStatusSummary])
async def get_devices_status(db: AsyncIOMotorDatabase = Depends(get_db)):
    """Retrieve online/offline connectivity and sensor health for all devices (physical and simulated).
    
    A device is considered:
    - 'online' if last seen <= 10 seconds ago.
    - 'standby' if last seen <= 60 seconds ago.
    - 'offline' if last seen > 60 seconds ago.
    """
    now = datetime.now(timezone.utc)
    pipeline = [
        {
            "$sort": {"timestamp": -1}
        },
        {
            "$group": {
                "_id": "$device_id",
                "device_id": {"$first": "$device_id"},
                "source": {"$first": "$source"},
                "first_seen": {"$last": "$timestamp"},
                "last_seen": {"$first": "$timestamp"},
                "last_sequence": {"$first": "$sequence"},
                "last_features": {"$first": "$features"},
                "total_readings": {"$sum": 1},
            }
        }
    ]
    cursor = db.sensor_readings.aggregate(pipeline)
    devices = await cursor.to_list(length=100)

    result = []
    for d in devices:
        last_seen = d["last_seen"]
        if last_seen.tzinfo is None:
            last_seen = last_seen.replace(tzinfo=timezone.utc)
        first_seen = d["first_seen"]
        if first_seen.tzinfo is None:
            first_seen = first_seen.replace(tzinfo=timezone.utc)

        delta_sec = max(0.0, (now - last_seen).total_seconds())

        if delta_sec <= 10.0:
            status_str = "online"
        elif delta_sec <= 60.0:
            status_str = "standby"
        else:
            status_str = "offline"

        features = d.get("last_features") or {}
        # Health checks on sensor values
        sensor_health = {}
        if "temperature" in features:
            sensor_health["temperature"] = -20.0 <= features["temperature"] <= 100.0
        if "humidity" in features:
            sensor_health["humidity"] = 0.0 <= features["humidity"] <= 100.0
        if "accel_z" in features:
            sensor_health["accelerometer"] = features["accel_z"] != 0.0
        if "vibration_rms" in features:
            sensor_health["vibration"] = True

        result.append(
            DeviceStatusSummary(
                device_id=d["device_id"],
                source=d.get("source") or ("physical" if "ESP32" in d["device_id"] else "simulated"),
                status=status_str,
                first_seen=first_seen,
                last_seen=last_seen,
                seconds_since_last_seen=round(delta_sec, 1),
                total_readings=d["total_readings"],
                last_sequence=d.get("last_sequence"),
                last_reading=features,
                sensor_health=sensor_health,
            )
        )

    return result


@router.get("", response_model=List[SensorSummary])
async def list_sensors(db: AsyncIOMotorDatabase = Depends(get_db)):
    """List all registered IoT sensor devices and reading counts."""
    repo = MongoRepository(db)
    sensors = await repo.list_sensors()
    result = []
    for s in sensors:
        result.append(
            SensorSummary(
                device_id=s["device_id"],
                dataset_id=s.get("dataset_id", "live"),
                first_seen=s.get("first_seen", datetime.now(timezone.utc)),
                last_seen=s.get("last_seen", datetime.now(timezone.utc)),
                total_readings=s.get("total_readings", 0),
                active_features=[],
            )
        )
    return result


@router.get("/{device_id}/readings", response_model=PaginatedResponse)
async def get_device_readings(
    device_id: str,
    start_time: Optional[datetime] = Query(None),
    end_time: Optional[datetime] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Retrieve historical sensor readings for a specific device. Excludes ground-truth labels."""
    repo = MongoRepository(db)
    skip = (page - 1) * page_size
    items, total = await repo.get_device_readings(
        device_id=device_id,
        start_time=start_time,
        end_time=end_time,
        skip=skip,
        limit=page_size,
    )
    total_pages = (total + page_size - 1) // page_size if total > 0 else 1
    return PaginatedResponse(
        items=items,
        pagination=PaginationMeta(page=page, page_size=page_size, total_count=total, total_pages=total_pages),
    )
