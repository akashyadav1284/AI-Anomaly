"""Unit tests for all anomaly detector models and core interface contracts."""
import pytest
import numpy as np
import pandas as pd

from ml.models.statistical import StatisticalZScoreDetector
from ml.models.isolation_forest import IsolationForestDetector
from ml.models.lof import LocalOutlierFactorDetector
from ml.models.one_class_svm import OneClassSVMDetector
from ml.models.random_forest import RandomForestAnomalyDetector
from ml.models.autoencoder import AutoencoderDetector


@pytest.fixture
def synthetic_features():
    """Generates small 2D normal feature matrix with injected extreme anomaly."""
    np.random.seed(42)
    # 100 normal observations centered around [10, 20]
    X_normal = np.random.normal(loc=[10.0, 20.0], scale=[1.0, 2.0], size=(100, 2))
    # 5 injected extreme anomalies
    X_anom = np.array([
        [50.0, 100.0],
        [-20.0, -10.0],
        [80.0, 20.0],
        [10.0, 95.0],
        [60.0, 80.0],
    ])
    X = np.vstack([X_normal, X_anom])
    y = np.array([0] * 100 + [1] * 5)
    return X, y


def test_statistical_zscore(synthetic_features):
    X, _ = synthetic_features
    detector = StatisticalZScoreDetector(threshold=0.5)
    detector.fit(X[:80])
    preds = detector.predict(X)

    assert preds.normalized_scores.shape == (105,)
    assert (preds.normalized_scores >= 0.0).all() and (preds.normalized_scores <= 1.0).all()
    # Injected anomalies at the end should have high scores
    assert np.mean(preds.normalized_scores[100:]) > np.mean(preds.normalized_scores[:80])


def test_isolation_forest(synthetic_features):
    X, _ = synthetic_features
    detector = IsolationForestDetector(n_estimators=50, random_state=42)
    detector.fit(X[:80])
    preds = detector.predict(X)

    assert preds.binary_labels.shape == (105,)
    # Anomalous points should have significantly higher scores than training normal points
    assert np.mean(preds.normalized_scores[100:]) > np.mean(preds.normalized_scores[:80])


def test_lof_novelty(synthetic_features):
    X, _ = synthetic_features
    detector = LocalOutlierFactorDetector(n_neighbors=10)
    detector.fit(X[:80])
    preds = detector.predict(X)

    assert len(preds.binary_labels) == 105
    assert np.mean(preds.normalized_scores[100:]) > np.mean(preds.normalized_scores[:80])


def test_one_class_svm(synthetic_features):
    X, _ = synthetic_features
    detector = OneClassSVMDetector(kernel="rbf", nu=0.05)
    detector.fit(X[:80])
    preds = detector.predict(X)

    assert len(preds.binary_labels) == 105
    assert (preds.normalized_scores >= 0.0).all() and (preds.normalized_scores <= 1.0).all()


def test_random_forest_supervised(synthetic_features):
    X, y = synthetic_features
    detector = RandomForestAnomalyDetector(n_estimators=30, random_state=42)
    detector.fit(X, y)
    preds = detector.predict(X)

    # Supervised model should cleanly identify anomalies
    assert np.mean(preds.normalized_scores[100:]) > 0.8
    assert np.mean(preds.normalized_scores[:100]) < 0.2


def test_autoencoder_pytorch(synthetic_features):
    X, _ = synthetic_features
    detector = AutoencoderDetector(epochs=10, batch_size=32, random_state=42)
    detector.fit(X[:80])
    preds = detector.predict(X)

    assert len(preds.binary_labels) == 105
    recon_errs = detector.get_feature_reconstruction_errors(X)
    assert recon_errs.shape == X.shape
    assert np.mean(preds.normalized_scores[100:]) > np.mean(preds.normalized_scores[:80])
