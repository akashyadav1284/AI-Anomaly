"""End-to-end model trainer orchestrating dataset loading, splitting, training, calibration, and artifact export."""
from __future__ import annotations

import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional, Union
import numpy as np
import pandas as pd

from ml.data.schemas import COL_GROUND_TRUTH, extract_features
from ml.data.preprocessing.splitting import TimeSeriesSplitter
from ml.models.base import BaseAnomalyDetector, ModelMetadata
from ml.models.statistical import StatisticalZScoreDetector
from ml.models.isolation_forest import IsolationForestDetector
from ml.models.lof import LocalOutlierFactorDetector
from ml.models.one_class_svm import OneClassSVMDetector
from ml.models.random_forest import RandomForestAnomalyDetector
from ml.models.autoencoder import AutoencoderDetector
from ml.preprocessing.pipeline import MLFeaturePipeline
from ml.training.threshold import ThresholdCalibrator
from ml.training.artifacts import ModelArtifactManager
from ml.evaluation.metrics import compute_point_metrics, compute_event_metrics


class ModelTrainer:
    """Trains, calibrates, evaluates, and persists anomaly detection models."""

    SUPPORTED_MODELS = {
        "statistical_zscore": StatisticalZScoreDetector,
        "isolation_forest": IsolationForestDetector,
        "lof": LocalOutlierFactorDetector,
        "local_outlier_factor": LocalOutlierFactorDetector,
        "one_class_svm": OneClassSVMDetector,
        "random_forest": RandomForestAnomalyDetector,
        "autoencoder": AutoencoderDetector,
    }

    def __init__(self, random_state: int = 42):
        self.random_state = random_state

    def train(
        self,
        df: pd.DataFrame,
        model_name: str = "isolation_forest",
        model_params: Optional[Dict[str, Any]] = None,
        scaler_type: str = "standard",
        enable_time_features: bool = False,
        train_ratio: float = 0.7,
        val_ratio: float = 0.15,
        test_ratio: float = 0.15,
        threshold_method: str = "contamination",  # 'contamination', 'quantile', 'f1_optimal'
        contamination: float = 0.03,
        output_dir: Optional[Union[str, Path]] = None,
    ) -> Dict[str, Any]:
        """Execute complete reproducible training workflow."""
        start_t = time.time()
        model_params = model_params or {}

        if model_name not in self.SUPPORTED_MODELS:
            raise ValueError(
                f"Unsupported model: '{model_name}'. Choose from: {sorted(list(self.SUPPORTED_MODELS.keys()))}"
            )

        # 1. Chronological splitting
        splits = TimeSeriesSplitter.chronological_split(
            df=df,
            train_ratio=train_ratio,
            val_ratio=val_ratio,
            test_ratio=test_ratio,
        )

        train_df = splits.train
        val_df = splits.val if splits.val is not None else splits.train
        test_df = splits.test

        # 2. Fit preprocessing pipeline on training observations ONLY
        pipeline = MLFeaturePipeline(
            scaler_type=scaler_type,
            enable_time_features=enable_time_features,
        )
        X_train = pipeline.fit_transform(train_df)
        X_val = pipeline.transform(val_df)
        X_test = pipeline.transform(test_df)

        # Target labels
        y_train = train_df[COL_GROUND_TRUTH].to_numpy() if COL_GROUND_TRUTH in train_df.columns else None
        y_val = val_df[COL_GROUND_TRUTH].to_numpy() if COL_GROUND_TRUTH in val_df.columns else None
        y_test = test_df[COL_GROUND_TRUTH].to_numpy() if COL_GROUND_TRUTH in test_df.columns else None

        # 3. Instantiate and train detector
        model_cls = self.SUPPORTED_MODELS[model_name]
        init_params = dict(model_params)
        if "random_state" in model_cls.__init__.__code__.co_varnames:
            init_params.setdefault("random_state", self.random_state)

        model: BaseAnomalyDetector = model_cls(**init_params)

        # For unsupervised models, train on all training samples
        if model_name == "random_forest":
            model.fit(X_train, y=y_train)
        else:
            model.fit(X_train)

        # 4. Calibrate threshold on validation data
        _, val_scores = model.score(X_val)

        if threshold_method == "f1_optimal" and y_val is not None:
            cal_res = ThresholdCalibrator.calibrate_by_f1_score(val_scores, y_val)
        else:
            cal_res = ThresholdCalibrator.calibrate_by_contamination(val_scores, contamination=contamination)

        model.set_threshold(cal_res.threshold, method=cal_res.method)

        # 5. Evaluate on held-out test data
        test_preds = model.predict(X_test)
        metrics_dict: Dict[str, Any] = {}

        if y_test is not None:
            point_m = compute_point_metrics(y_true=y_test, y_pred=test_preds.binary_labels, scores=test_preds.normalized_scores)
            event_m = compute_event_metrics(y_true=y_test, y_pred=test_preds.binary_labels)
            metrics_dict["point_metrics"] = point_m.to_dict()
            metrics_dict["event_metrics"] = event_m.to_dict()

        duration = time.time() - start_t

        # 6. Metadata sidecar
        meta = ModelMetadata(
            model_name=model_name,
            model_version=model.model_version,
            algorithm=model_name,
            feature_names=pipeline.feature_names_,
            threshold=model.threshold,
            threshold_method=model.threshold_method,
            created_at=datetime.now(timezone.utc).isoformat(),
            hyperparameters=init_params,
            training_dataset_id=df.get("dataset_id", pd.Series(["unknown"])).iloc[0] if len(df) > 0 else "unknown",
            training_row_count=len(train_df),
            training_duration_seconds=duration,
            evaluation_metrics=metrics_dict,
        )

        # 7. Persist artifact if output_dir specified
        saved_path = None
        if output_dir:
            saved_path = ModelArtifactManager.save(
                model=model,
                pipeline=pipeline,
                output_dir=output_dir,
                metadata=meta,
                overwrite=True,
            )

        return {
            "model": model,
            "pipeline": pipeline,
            "metadata": meta.to_dict(),
            "metrics": metrics_dict,
            "saved_path": str(saved_path) if saved_path else None,
            "duration_seconds": duration,
        }
