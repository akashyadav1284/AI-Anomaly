"""Model registry service managing artifact discovery, validation, caching, and execution."""
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional, Tuple
import numpy as np
import pandas as pd
from app.core.config import get_settings
from app.core.logging import setup_logging
from ml.models.base import BaseAnomalyDetector
from ml.preprocessing.pipeline import MLFeaturePipeline
from ml.training.artifacts import ModelArtifactManager
from ml.explainability.feature_contributions import FeatureContributionExplainer

logger = setup_logging()


class ModelRegistryService:
    """Manages loaded model caches and executes safe inference."""

    _model_cache: Dict[str, Tuple[BaseAnomalyDetector, MLFeaturePipeline, Dict[str, Any]]] = {}

    @classmethod
    def get_or_load_model(
        cls,
        model_name: str = "isolation_forest",
        version: str = "latest",
    ) -> Tuple[BaseAnomalyDetector, MLFeaturePipeline, Dict[str, Any]]:
        settings = get_settings()
        cache_key = f"{model_name}:{version}"

        if cache_key in cls._model_cache:
            return cls._model_cache[cache_key]

        # Resolve artifact directory inside configured models folder
        base_dir = Path(settings.ARTIFACTS_DIR)
        target_dir = base_dir / model_name
        if not target_dir.exists():
            # Check relative to repo root
            target_dir = Path("artifacts/models") / model_name

        if not target_dir.exists():
            raise FileNotFoundError(
                f"Model artifact directory not found for '{model_name}'. Expected at {target_dir}"
            )

        logger.info("Loading model artifact from %s...", target_dir)
        model, pipeline, metadata = ModelArtifactManager.load(target_dir, verify_checksum=True)

        cls._model_cache[cache_key] = (model, pipeline, metadata)
        return model, pipeline, metadata

    @classmethod
    def run_inference(
        cls,
        features: Dict[str, float],
        model_name: str = "isolation_forest",
        model_version: str = "latest",
    ) -> Dict[str, Any]:
        model, pipeline, metadata = cls.get_or_load_model(model_name, model_version)

        # Validate input features against model's expected schema
        expected_features = pipeline.feature_names_
        missing = [f for f in expected_features if f not in features]
        if missing:
            raise ValueError(
                f"Feature schema mismatch for model '{model_name}'. Missing expected features: {missing}"
            )

        # Build single-row DataFrame with exact training column order
        row_dict = {f: [features[f]] for f in expected_features}
        # Add minimal required metadata columns so cleaner/pipeline can operate safely
        row_dict["timestamp"] = [pd.Timestamp.now(tz="UTC")]
        row_dict["device_id"] = ["temp_device"]
        row_dict["dataset_id"] = ["inference"]

        df_in = pd.DataFrame(row_dict)

        # Transform features using fitted pipeline
        X = pipeline.transform(df_in)
        preds = model.predict(X)

        raw_score = float(preds.raw_scores[0])
        norm_score = float(preds.normalized_scores[0])
        is_anomaly = bool(preds.binary_labels[0] == 1)
        threshold = float(preds.threshold)

        # Feature explanation
        explainer = FeatureContributionExplainer(feature_names=expected_features)
        # Approximate baseline from 1.0 (mean) and 1.0 (std) on standardized features
        explainer.baseline_means = np.zeros(len(expected_features))
        explainer.baseline_stds = np.ones(len(expected_features))

        explanation = explainer.explain_sample(
            sample_vec=X[0],
            sample_index=0,
            anomaly_score=norm_score,
            is_anomaly=is_anomaly,
        )

        # Dynamic severity calibration
        if norm_score >= 0.90:
            severity = "CRITICAL"
        elif norm_score >= 0.78:
            severity = "HIGH"
        elif norm_score >= 0.60:
            severity = "MEDIUM"
        else:
            severity = "LOW" if is_anomaly else "NORMAL"

        return {
            "model_name": model_name,
            "model_version": metadata.get("model_version", "0.1.0"),
            "raw_score": raw_score,
            "normalized_score": norm_score,
            "decision_threshold": threshold,
            "is_anomaly": is_anomaly,
            "explanation": explanation.summary,
            "top_contributing_features": explanation.top_contributing_features,
            "severity": severity,
        }
