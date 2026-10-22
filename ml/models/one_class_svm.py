"""One-Class Support Vector Machine (OC-SVM) anomaly detector."""
from __future__ import annotations

from typing import Any, Dict, Optional, Tuple, Union
import numpy as np
import pandas as pd
from sklearn.svm import OneClassSVM
from ml.models.base import BaseAnomalyDetector


class OneClassSVMDetector(BaseAnomalyDetector):
    """One-Class SVM for non-linear boundary estimation on predominantly normal sensor data."""

    def __init__(
        self,
        kernel: str = "rbf",
        gamma: Union[str, float] = "scale",
        nu: float = 0.05,
    ):
        super().__init__(model_name="one_class_svm", model_version="0.1.0")
        self.kernel = kernel
        self.gamma = gamma
        self.nu = nu
        self.model: Optional[OneClassSVM] = None

    def fit(self, X: Union[pd.DataFrame, np.ndarray], y: Optional[np.ndarray] = None) -> OneClassSVMDetector:
        arr = self._validate_input_features(X)

        self.model = OneClassSVM(
            kernel=self.kernel,
            gamma=self.gamma,
            nu=self.nu,
        )
        self.model.fit(arr)

        train_scores = -self.model.score_samples(arr)
        self.min_score_ = float(np.min(train_scores))
        self.max_score_ = float(np.max(train_scores) + 1e-4)

        self.is_fitted = True
        return self

    def score(self, X: Union[pd.DataFrame, np.ndarray]) -> Tuple[np.ndarray, np.ndarray]:
        arr = self._validate_input_features(X)
        raw_scores = -self.model.score_samples(arr)
        normalized_scores = self._normalize_scores(raw_scores, higher_is_anomalous=True)
        return raw_scores, normalized_scores

    def get_params(self) -> Dict[str, Any]:
        params = super().get_params()
        params.update({
            "kernel": self.kernel,
            "gamma": self.gamma,
            "nu": self.nu,
        })
        return params
