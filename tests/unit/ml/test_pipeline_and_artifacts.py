"""Unit tests for training pipeline, calibration, persistence, metrics, and explanations."""
import pytest
import numpy as np
import pandas as pd
from ml.data.generators.sensor_generator import IoTSensorGenerator
from ml.training.trainer import ModelTrainer
from ml.training.artifacts import ModelArtifactManager
from ml.training.threshold import ThresholdCalibrator
from ml.evaluation.metrics import compute_point_metrics, compute_event_metrics
from ml.explainability.feature_contributions import FeatureContributionExplainer


@pytest.fixture
def telemetry_df():
    gen = IoTSensorGenerator(random_state=42)
    return gen.generate(n_rows=200, devices=["dev_01"], inject_anomalies=True)


def test_threshold_calibration():
    scores = np.linspace(0.0, 1.0, 100)
    res = ThresholdCalibrator.calibrate_by_quantile(scores, quantile=0.90)
    assert 0.88 <= res.threshold <= 0.92

    y_true = np.array([0] * 90 + [1] * 10)
    f1_res = ThresholdCalibrator.calibrate_by_f1_score(scores, y_true)
    assert f1_res.threshold > 0.5


def test_point_and_event_metrics():
    y_true = np.array([0, 0, 1, 1, 1, 0, 0, 1, 1, 0])
    y_pred = np.array([0, 0, 0, 1, 1, 0, 0, 1, 0, 0])

    pm = compute_point_metrics(y_true, y_pred)
    assert pm.true_positives == 3
    assert pm.false_negatives == 2
    assert pm.precision == 1.0

    em = compute_event_metrics(y_true, y_pred)
    assert em.total_events == 2
    assert em.detected_events == 2
    assert em.event_recall == 1.0


def test_feature_contribution_explainer():
    explainer = FeatureContributionExplainer(feature_names=["temp", "vibe"])
    X_baseline = np.array([[20.0, 1.0], [21.0, 1.1], [19.5, 0.9]])
    explainer.fit_baseline(X_baseline)

    sample = np.array([80.0, 1.0])  # extreme temperature spike
    exp = explainer.explain_sample(
        sample_vec=sample,
        sample_index=0,
        anomaly_score=0.95,
        is_anomaly=True,
    )

    assert exp.is_anomaly is True
    assert exp.top_contributing_features[0]["feature"] == "temp"


def test_end_to_end_trainer_save_and_load(telemetry_df, tmp_path):
    trainer = ModelTrainer(random_state=42)
    art_dir = tmp_path / "iso_forest_art"

    res = trainer.train(
        df=telemetry_df,
        model_name="isolation_forest",
        output_dir=art_dir,
    )

    assert res["saved_path"] is not None
    assert (art_dir / "model.joblib").exists()
    assert (art_dir / "pipeline.joblib").exists()
    assert (art_dir / "metadata.json").exists()

    # Load and test prediction consistency
    model, pipeline, meta = ModelArtifactManager.load(art_dir)
    assert meta["model_name"] == "isolation_forest"

    X = pipeline.transform(telemetry_df.iloc[:20])
    preds = model.predict(X)
    assert len(preds.binary_labels) == 20
