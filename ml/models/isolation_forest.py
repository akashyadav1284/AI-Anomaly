"""Isolation Forest anomaly detector wrapping scikit-learn."""
from __future__ import annotations

from typing import Any, Dict, Optional, Tuple, Union
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from ml.models.base import BaseAnomalyDetector


class IsolationForestDetector(BaseAnomalyDetector):
    """Isolation Forest anomaly detector.
    
    Standard convention:
    - scikit-learn score_samples returns negative anomaly score (lower is more anomalous).
    - We invert score_samples so that higher raw score indicates greater anomaly likelihood.
    - Normalized scores map monotonically into [0.0, 1.0].
    """

    def __init__(
        self,
        n_estimators: int = 100,
        contamination: Union[float, str] = "auto",
        max_samples: Union[int, float, str] = "auto",
        random_state: int = 42,
    ):
        super().__init__(
            model_name="isolation_forest",
            model_version="0.1.0",
            random_state=random_state,
        )
        self.n_estimators = n_estimators
        self.contamination = contamination
        self.max_samples = max_samples
        self.model: Optional[IsolationForest] = None

    def fit(self, X: Union[pd.DataFrame, np.ndarray], y: Optional[np.ndarray] = None) -> IsolationForestDetector:
        arr = self._validate_input_features(X)

        self.model = IsolationForest(
            n_estimators=self.n_estimators,
            contamination=self.contamination,
            max_samples=self.max_samples,
            random_state=self.random_state,
            n_jobs=-1,
        )
        self.model.fit(arr)

        # Compute raw scores on training data: -score_samples
        train_scores = -self.model.score_samples(arr)
        self.min_score_ = float(np.min(train_scores))
        self.max_score_ = float(np.max(train_scores) + 1e-4)

        self.is_fitted = True
        return self

    def score(self, X: Union[pd.DataFrame, np.ndarray]) -> Tuple[np.ndarray, np.ndarray]:
        arr = self._validate_input_features(X)
        # raw scores: higher is more anomalous
        raw_scores = -self.model.score_samples(arr)
        normalized_scores = self._normalize_scores(raw_scores, higher_is_anomalous=True)
        return raw_scores, normalized_scores

    def get_params(self) -> Dict[str, Any]:
        params = super().get_params()
        params.update({
            "n_estimators": self.n_estimators,
            "contamination": self.contamination,
            "max_samples": self.max_samples,
        })
        return params
