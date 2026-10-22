"""Benchmark research experiments executing real training, ablation, robustness, and evaluations."""
from __future__ import annotations

import time
from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd

from ml.data.generators.sensor_generator import IoTSensorGenerator
from ml.data.schemas import COL_GROUND_TRUTH, extract_features
from ml.training.trainer import ModelTrainer
from ml.evaluation.metrics import compute_point_metrics, compute_event_metrics


class ResearchExperimentRunner:
    """Executes verifiable ML research experiments with actual algorithms and measurements."""

    @classmethod
    def run_benchmark_comparison(
        cls,
        models: Optional[List[str]] = None,
        sample_count: int = 1500,
        random_seed: int = 42,
    ) -> List[Dict[str, Any]]:
        """Run standard benchmark comparing all anomaly detection algorithms on synthetic IoT telemetry."""
        target_models = models or [
            "isolation_forest",
            "one_class_svm",
            "lof",
            "statistical_zscore",
            "random_forest",
            "autoencoder",
        ]

        # Generate shared reproducible evaluation dataset
        gen = IoTSensorGenerator(random_state=random_seed)
        df = gen.generate(
            n_rows=sample_count,
            devices=["sensor_node_01", "sensor_node_02"],
            anomaly_rate=0.08,
            inject_anomalies=True,
        )

        results = []
        trainer = ModelTrainer(random_state=random_seed)

        for model_name in target_models:
            start_t = time.perf_counter()
            try:
                train_out = trainer.train(
                    df=df,
                    model_name=model_name,
                    threshold_method="contamination",
                    contamination=0.08,
                )
                fit_duration = time.perf_counter() - start_t
                pm = train_out["metrics"].get("point_metrics", {})
                em = train_out["metrics"].get("event_metrics", {})

                results.append({
                    "model_name": model_name,
                    "algorithm": model_name,
                    "status": "completed",
                    "training_duration_seconds": round(fit_duration, 4),
                    "precision": round(float(pm.get("precision", 0.0)), 4),
                    "recall": round(float(pm.get("recall", 0.0)), 4),
                    "f1_score": round(float(pm.get("f1_score", 0.0)), 4),
                    "pr_auc": round(float(pm.get("pr_auc", 0.0)), 4),
                    "roc_auc": round(float(pm.get("roc_auc", 0.0)), 4),
                    "false_alarm_rate": round(float(pm.get("false_alarm_rate", 0.0)), 4),
                    "event_recall": round(float(em.get("event_recall", 0.0)), 4),
                    "detection_delay": round(float(em.get("mean_detection_delay", 0.0)), 2),
                    "sample_count": sample_count,
                })
            except Exception as e:
                results.append({
                    "model_name": model_name,
                    "algorithm": model_name,
                    "status": "failed",
                    "error": str(e),
                })

        return results

    @classmethod
    def run_noise_sensitivity_experiment(
        cls,
        model_name: str = "isolation_forest",
        noise_levels: Optional[List[float]] = None,
        sample_count: int = 1200,
        random_seed: int = 42,
    ) -> List[Dict[str, Any]]:
        """Evaluate model degradation under increasing gaussian sensor noise."""
        levels = noise_levels or [0.1, 0.5, 1.0, 2.0, 3.5]
        results = []

        gen = IoTSensorGenerator(random_state=random_seed)
        df_base = gen.generate(
            n_rows=sample_count,
            devices=["sensor_node_01"],
            anomaly_rate=0.08,
            inject_anomalies=True,
        )

        feature_cols = extract_features(df_base).columns.tolist()
        trainer = ModelTrainer(random_state=random_seed)
        train_out = trainer.train(df=df_base, model_name=model_name)
        model = train_out["model"]
        pipeline = train_out["pipeline"]

        for sigma in levels:
            df_noisy = df_base.copy()
            rng = np.random.default_rng(random_seed)
            for col in feature_cols:
                df_noisy[col] = df_noisy[col] + rng.normal(0, sigma, size=len(df_noisy))

            X_test, _ = pipeline.transform(df_noisy)
            preds = model.predict(X_test)
            pm = compute_point_metrics(
                y_true=df_noisy[COL_GROUND_TRUTH].to_numpy(),
                y_pred=preds.binary_labels,
                scores=preds.normalized_scores,
            )

            results.append({
                "noise_sigma": sigma,
                "model_name": model_name,
                "precision": round(pm.precision, 4),
                "recall": round(pm.recall, 4),
                "f1_score": round(pm.f1_score, 4),
                "pr_auc": round(pm.pr_auc, 4),
            })

        return results

    @classmethod
    def run_missing_data_robustness(
        cls,
        model_name: str = "isolation_forest",
        missing_rates: Optional[List[float]] = None,
        sample_count: int = 1200,
        random_seed: int = 42,
    ) -> List[Dict[str, Any]]:
        """Evaluate model robustness against missing sensor channels."""
        rates = missing_rates or [0.0, 0.05, 0.15, 0.30]
        results = []

        gen = IoTSensorGenerator(random_state=random_seed)
        df_base = gen.generate(
            n_rows=sample_count,
            devices=["sensor_node_01"],
            anomaly_rate=0.08,
            inject_anomalies=True,
        )
        feature_cols = extract_features(df_base).columns.tolist()

        trainer = ModelTrainer(random_state=random_seed)
        train_out = trainer.train(df=df_base, model_name=model_name)
        model = train_out["model"]
        pipeline = train_out["pipeline"]

        for rate in rates:
            df_missing = df_base.copy()
            if rate > 0:
                rng = np.random.default_rng(random_seed)
                for col in feature_cols:
                    mask = rng.uniform(0, 1, size=len(df_missing)) < rate
                    df_missing.loc[mask, col] = np.nan

            X_test, _ = pipeline.transform(df_missing)
            preds = model.predict(X_test)
            pm = compute_point_metrics(
                y_true=df_base[COL_GROUND_TRUTH].to_numpy(),
                y_pred=preds.binary_labels,
                scores=preds.normalized_scores,
            )

            results.append({
                "missing_rate": rate,
                "model_name": model_name,
                "f1_score": round(pm.f1_score, 4),
                "precision": round(pm.precision, 4),
                "recall": round(pm.recall, 4),
            })

        return results
