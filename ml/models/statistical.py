"""Statistical z-score and rolling deviation anomaly detector."""
from __future__ import annotations

from typing import Optional, Tuple, Union
import numpy as np
import pandas as pd
from ml.models.base import BaseAnomalyDetector


class StatisticalZScoreDetector(BaseAnomalyDetector):
    """Detects multi-channel anomalies via normalized distance from baseline distribution.
    
    Supports:
    - Global baseline z-score (using fitted mean and std)
    - Causal rolling window z-score (avoiding future leakage)
    - Multichannel Euclidean combination
    """

    def __init__(
        self,
        rolling_window: Optional[int] = None,
        min_std: float = 1e-4,
        threshold: float = 0.5,
    ):
        super().__init__(model_name="statistical_zscore", model_version="0.1.0")
        self.rolling_window = rolling_window
        self.min_std = min_std
        self.threshold = threshold
        self.means_: Optional[np.ndarray] = None
        self.stds_: Optional[np.ndarray] = None

    def fit(self, X: Union[pd.DataFrame, np.ndarray], y: Optional[np.ndarray] = None) -> StatisticalZScoreDetector:
        arr = self._validate_input_features(X)
        self.means_ = np.mean(arr, axis=0)
        self.stds_ = np.std(arr, axis=0)
        self.stds_ = np.maximum(self.stds_, self.min_std)

        # Baseline calibration on training data
        z_scores = np.abs((arr - self.means_) / self.stds_)
        multivariate_z = np.max(z_scores, axis=1)

        self.min_score_ = 0.0
        # 6 standard deviations represents extreme outlier upper bound
        self.max_score_ = max(6.0, float(np.percentile(multivariate_z, 99.5)))
        self.is_fitted = True
        return self

    def score(self, X: Union[pd.DataFrame, np.ndarray]) -> Tuple[np.ndarray, np.ndarray]:
        arr = self._validate_input_features(X)

        if self.rolling_window and self.rolling_window > 1:
            # Causal rolling mean and std
            df_temp = pd.DataFrame(arr)
            roll_mean = df_temp.rolling(window=self.rolling_window, min_periods=1).mean().to_numpy()
            roll_std = df_temp.rolling(window=self.rolling_window, min_periods=1).std().to_numpy()
            roll_std = np.nan_to_num(roll_std, nan=self.stds_)
            roll_std = np.maximum(roll_std, self.min_std)
            z_scores = np.abs((arr - roll_mean) / roll_std)
        else:
            z_scores = np.abs((arr - self.means_) / self.stds_)

        # Max channel z-score as overall anomaly score
        raw_scores = np.max(z_scores, axis=1)
        normalized_scores = self._normalize_scores(raw_scores, higher_is_anomalous=True)
        return raw_scores, normalized_scores
