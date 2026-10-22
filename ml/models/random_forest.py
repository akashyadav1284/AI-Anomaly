"""Supervised Random Forest detector for datasets with trustworthy ground truth labels."""
from __future__ import annotations

from typing import Any, Dict, Optional, Tuple, Union
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from ml.models.base import BaseAnomalyDetector


class RandomForestAnomalyDetector(BaseAnomalyDetector):
    """Supervised Random Forest classification detector.
    
    Notes:
    - Requires binary target ground truth labels (0 = normal, 1 = anomaly) during fit.
    - Anomaly score represents the predicted class-1 probability P(anomaly | x).
    """

    def __init__(
        self,
        n_estimators: int = 100,
        max_depth: Optional[int] = 10,
        class_weight: str = "balanced",
        random_state: int = 42,
    ):
        super().__init__(
            model_name="random_forest",
            model_version="0.1.0",
            random_state=random_state,
        )
        self.n_estimators = n_estimators
        self.max_depth = max_depth
        self.class_weight = class_weight
        self.model: Optional[RandomForestClassifier] = None

    def fit(self, X: Union[pd.DataFrame, np.ndarray], y: Optional[np.ndarray] = None) -> RandomForestAnomalyDetector:
        if y is None:
            raise ValueError("Supervised RandomForest requires binary target labels y to fit.")

        arr = self._validate_input_features(X)
        y_arr = np.asarray(y, dtype=int)

        if len(np.unique(y_arr)) < 2:
            # Fallback if training set contains only normal rows: dummy probabilities
            pass

        self.model = RandomForestClassifier(
            n_estimators=self.n_estimators,
            max_depth=self.max_depth,
            class_weight=self.class_weight,
            random_state=self.random_state,
            n_jobs=-1,
        )
        self.model.fit(arr, y_arr)

        self.min_score_ = 0.0
        self.max_score_ = 1.0
        self.is_fitted = True
        return self

    def score(self, X: Union[pd.DataFrame, np.ndarray]) -> Tuple[np.ndarray, np.ndarray]:
        arr = self._validate_input_features(X)

        if hasattr(self.model, "predict_proba"):
            probs = self.model.predict_proba(arr)
            # Find class index for label 1
            if 1 in self.model.classes_:
                c1_idx = list(self.model.classes_).index(1)
                anomaly_prob = probs[:, c1_idx]
            else:
                anomaly_prob = np.zeros(len(arr))
        else:
            anomaly_prob = self.model.predict(arr).astype(float)

        raw_scores = anomaly_prob
        normalized_scores = np.clip(anomaly_prob, 0.0, 1.0)
        return raw_scores, normalized_scores

    def get_params(self) -> Dict[str, Any]:
        params = super().get_params()
        params.update({
            "n_estimators": self.n_estimators,
            "max_depth": self.max_depth,
            "class_weight": self.class_weight,
        })
        return params
