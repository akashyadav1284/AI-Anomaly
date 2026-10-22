"""Typed abstract base class and common contracts for time-series anomaly detectors."""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple, Union
import numpy as np
import pandas as pd


@dataclass
class AnomalyScores:
    """Standard container for model inference outputs.
    
    Conventions:
    - raw_scores: Original unmodified score output by the underlying algorithm.
    - normalized_scores: Standardized continuous score in [0.0, 1.0], where higher strictly indicates
      greater anomaly likelihood.
    - binary_labels: Binary prediction (0 = normal, 1 = anomalous) computed using calibrated threshold.
    - threshold: The decision threshold applied on normalized_scores.
    """
    raw_scores: np.ndarray
    normalized_scores: np.ndarray
    binary_labels: np.ndarray
    threshold: float
    feature_contributions: Optional[np.ndarray] = None  # Shape: (N, n_features) if available


@dataclass
class ModelMetadata:
    """Standardized metadata tracking model configuration, training provenance, and schema."""
    model_name: str
    model_version: str
    algorithm: str
    feature_names: List[str]
    threshold: float
    threshold_method: str
    created_at: str
    hyperparameters: Dict[str, Any] = field(default_factory=dict)
    training_dataset_id: Optional[str] = None
    training_row_count: Optional[int] = None
    training_duration_seconds: Optional[float] = None
    evaluation_metrics: Dict[str, Any] = field(default_factory=dict)
    checksum_sha256: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class BaseAnomalyDetector(ABC):
    """Abstract interface governing all statistical, classical, and neural anomaly detectors."""

    def __init__(
        self,
        model_name: str,
        model_version: str = "0.1.0",
        random_state: Optional[int] = 42,
    ):
        self.model_name = model_name
        self.model_version = model_version
        self.random_state = random_state
        self.is_fitted: bool = False
        self.feature_names: List[str] = []
        self.threshold: float = 0.5
        self.threshold_method: str = "default"
        self.min_score_: float = 0.0
        self.max_score_: float = 1.0

    @abstractmethod
    def fit(self, X: Union[pd.DataFrame, np.ndarray], y: Optional[np.ndarray] = None) -> BaseAnomalyDetector:
        """Fit detector on training data. y is optional for unsupervised/semi-supervised models."""
        pass

    @abstractmethod
    def score(self, X: Union[pd.DataFrame, np.ndarray]) -> Tuple[np.ndarray, np.ndarray]:
        """Compute anomaly scores. Returns tuple of (raw_scores, normalized_scores in [0, 1])."""
        pass

    def predict(
        self,
        X: Union[pd.DataFrame, np.ndarray],
        threshold: Optional[float] = None,
    ) -> AnomalyScores:
        """Predict continuous scores and binary anomaly classifications."""
        if not self.is_fitted:
            raise RuntimeError(f"Model '{self.model_name}' must be fitted before predict.")

        raw_scores, norm_scores = self.score(X)
        effective_threshold = threshold if threshold is not None else self.threshold
        binary_labels = (norm_scores >= effective_threshold).astype(int)

        return AnomalyScores(
            raw_scores=raw_scores,
            normalized_scores=norm_scores,
            binary_labels=binary_labels,
            threshold=effective_threshold,
        )

    def set_threshold(self, threshold: float, method: str = "manual") -> None:
        """Set decision threshold applied on normalized scores."""
        self.threshold = float(threshold)
        self.threshold_method = method

    def _normalize_scores(self, raw_scores: np.ndarray, higher_is_anomalous: bool = True) -> np.ndarray:
        """Normalize raw scores into [0, 1] interval where 1 indicates extreme anomaly."""
        scores = raw_scores.copy().astype(float)
        if not higher_is_anomalous:
            scores = -scores

        denom = self.max_score_ - self.min_score_
        if denom <= 1e-12:
            return np.zeros_like(scores)

        norm = (scores - self.min_score_) / denom
        return np.clip(norm, 0.0, 1.0)

    def _validate_input_features(self, X: Union[pd.DataFrame, np.ndarray]) -> np.ndarray:
        """Validate input features, verifying column identity and ordering."""
        if isinstance(X, pd.DataFrame):
            if self.feature_names:
                missing = [f for f in self.feature_names if f not in X.columns]
                if missing:
                    raise ValueError(f"Input dataframe missing expected feature columns: {missing}")
                # Enforce exact stable training column order
                arr = X[self.feature_names].to_numpy(dtype=float)
            else:
                self.feature_names = list(X.columns)
                arr = X.to_numpy(dtype=float)
        else:
            arr = np.asarray(X, dtype=float)
            if self.feature_names and arr.shape[1] != len(self.feature_names):
                raise ValueError(
                    f"Expected {len(self.feature_names)} features, got array of shape {arr.shape}"
                )

        if np.isinf(arr).any():
            raise ValueError("Input features contain infinite values.")
        if np.isnan(arr).any():
            raise ValueError("Input features contain NaN values. Ensure imputer is executed first.")

        return arr

    def get_params(self) -> Dict[str, Any]:
        """Serialize model hyperparameters."""
        return {
            "model_name": self.model_name,
            "model_version": self.model_version,
            "random_state": self.random_state,
            "threshold": self.threshold,
            "threshold_method": self.threshold_method,
            "min_score_": self.min_score_,
            "max_score_": self.max_score_,
            "feature_names": self.feature_names,
        }
