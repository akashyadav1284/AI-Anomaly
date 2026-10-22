"""Local Outlier Factor (LOF) configured for novelty detection on unseen observations."""
from __future__ import annotations

from typing import Any, Dict, Optional, Tuple, Union
import numpy as np
import pandas as pd
from sklearn.neighbors import LocalOutlierFactor
from ml.models.base import BaseAnomalyDetector


class LocalOutlierFactorDetector(BaseAnomalyDetector):
    """Local Outlier Factor detector configured with novelty=True.
    
    Setting novelty=True enables predicting on unseen test data rather than training-only outlier fit.
    """

    def __init__(
        self,
        n_neighbors: int = 20,
        contamination: Union[float, str] = "auto",
        metric: str = "minkowski",
    ):
        super().__init__(model_name="local_outlier_factor", model_version="0.1.0")
        self.n_neighbors = n_neighbors
        self.contamination = contamination
        self.metric = metric
        self.model: Optional[LocalOutlierFactor] = None

    def fit(self, X: Union[pd.DataFrame, np.ndarray], y: Optional[np.ndarray] = None) -> LocalOutlierFactorDetector:
        arr = self._validate_input_features(X)

        self.model = LocalOutlierFactor(
            n_neighbors=min(self.n_neighbors, len(arr) - 1),
            contamination=self.contamination,
            metric=self.metric,
            novelty=True,
            n_jobs=-1,
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
            "n_neighbors": self.n_neighbors,
            "contamination": self.contamination,
            "metric": self.metric,
        })
        return params
