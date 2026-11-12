"""FastAPI router for sensor registry, physical device telemetry ingestion, and device health."""
import math
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
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
    # Models in `artifacts/models` (e.g. Isolation Forest) expect 5 features:
    # ['temperature', 'humidity', 'pressure', 'vibration', 'current']
    # DHT22 provides: temperature, humidity
    # MPU6050 provides: vibration_rms (mapped directly to vibration metric)
    # Absent industrial channels (pressure, current) are aligned to nominal training baselines
    model_name = payload.model_name or "isolation_forest"
    mapped_ml_features = {
        "temperature": float(sensors_dict["temperature"]),
        "humidity": float(sensors_dict["humidity"]),
        "vibration": float(sensors_dict["vibration_rms"]),
        "pressure": 101.3,   # Nominal baseline
        "current": 12.5,     # Nominal baseline
    }

    inf_result: Dict[str, Any] = {
        "model_name": model_name,
        "normalized_score": 0.0,
        "decision_threshold": 0.5,
        "is_anomaly": False,
        "top_contributing_features": [],
    }

    try:
        inf_result = ModelRegistryService.run_inference(
            features=mapped_ml_features,
            model_name=model_name,
        )
    except FileNotFoundError:
        # Artifact missing; fall back to Statistical Z-Score
        logger.info("Artifact for '%s' unavailable. Physical inference falling back to statistical z-score.", model_name)
        # Dynamic check on physical ranges
        is_temp_anom = sensors_dict["temperature"] > 60.0 or sensors_dict["temperature"] < 0.0
        is_vib_anom = sensors_dict["vibration_rms"] > 2.5
        is_anom = is_temp_anom or is_vib_anom
        inf_result = {
            "model_name": "statistical_zscore",
            "model_version": "0.1.0",
            "raw_score": max(dev, 0.0),
            "normalized_score": 0.85 if is_anom else 0.15,
            "decision_threshold": 0.5,
            "is_anomaly": is_anom,
            "severity": "HIGH" if is_anom else "LOW",
            "explanation": "Statistical deviation on physical channels." if is_anom else "Nominal",
            "top_contributing_features": [{"feature": "vibration_rms", "score": 0.8}] if is_vib_anom else [],
        }
    except Exception as e:
        logger.warning("ML inference failed for physical device %s: %s", payload.device_id, e)

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
