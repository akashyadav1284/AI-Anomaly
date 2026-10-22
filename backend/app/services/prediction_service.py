"""Prediction and anomaly services managing inference execution and record persistence."""
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from app.core.logging import setup_logging
from app.repositories.mongo_repo import MongoRepository
from app.services.model_service import ModelRegistryService

logger = setup_logging()


class PredictionService:
    """Coordinates prediction requests, inference execution, and database logging."""

    def __init__(self, repo: MongoRepository):
        self.repo = repo

    async def predict_single(
        self,
        device_id: str,
        features: Dict[str, float],
        timestamp: Optional[datetime] = None,
        model_name: str = "isolation_forest",
        model_version: str = "latest",
    ) -> Dict[str, Any]:
        ts = timestamp or datetime.now(timezone.utc)
        pred_id = f"PRED_{uuid.uuid4().hex[:12]}"

        # 1. Execute actual model inference via ModelRegistryService
        inf_result = ModelRegistryService.run_inference(
            features=features,
            model_name=model_name,
            model_version=model_version,
        )

        persisted = False
        # 2. Persist sensor reading and anomaly record if DB is available
        try:
            reading_doc = {
                "reading_id": pred_id,
                "device_id": device_id,
                "dataset_id": "live_stream",
                "timestamp": ts,
                "features": features,
            }
            await self.repo.insert_sensor_readings([reading_doc])

            if inf_result["is_anomaly"]:
                anomaly_doc = {
                    "anomaly_id": f"ANOM_{uuid.uuid4().hex[:12]}",
                    "reading_id": pred_id,
                    "device_id": device_id,
                    "timestamp": ts,
                    "model_name": inf_result["model_name"],
                    "model_version": inf_result["model_version"],
                    "raw_score": inf_result["raw_score"],
                    "normalized_score": inf_result["normalized_score"],
                    "threshold": inf_result["decision_threshold"],
                    "severity": inf_result["severity"],
                    "review_status": "pending",
                    "affected_features": [f["feature"] for f in inf_result["top_contributing_features"]],
                    "explanation": inf_result["explanation"],
                    "created_at": datetime.now(timezone.utc),
                }
                await self.repo.insert_anomaly(anomaly_doc)

            persisted = True
        except Exception as e:
            logger.warning("Could not persist prediction to database: %s", e)

        return {
            "prediction_id": pred_id,
            "device_id": device_id,
            "timestamp": ts,
            "model_name": inf_result["model_name"],
            "model_version": inf_result["model_version"],
            "raw_score": inf_result["raw_score"],
            "normalized_anomaly_score": inf_result["normalized_score"],
            "decision_threshold": inf_result["decision_threshold"],
            "is_anomaly": inf_result["is_anomaly"],
            "explanation": inf_result["explanation"],
            "top_contributing_features": inf_result["top_contributing_features"],
            "persisted": persisted,
        }
