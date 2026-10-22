"""Feature attribution and explanation generation for anomalous readings."""
from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd


@dataclass
class AnomalyExplanation:
    """Human-readable explanation of why a specific sensor reading was flagged."""
    sample_index: int
    anomaly_score: float
    is_anomaly: bool
    top_contributing_features: List[Dict[str, Any]]
    summary: str

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class FeatureContributionExplainer:
    """Analyzes multivariate sensor readings to compute feature deviations and attribution scores."""

    def __init__(
        self,
        feature_names: List[str],
        baseline_means: Optional[np.ndarray] = None,
        baseline_stds: Optional[np.ndarray] = None,
    ):
        self.feature_names = feature_names
        self.baseline_means = baseline_means
        self.baseline_stds = baseline_stds

    def fit_baseline(self, X: np.ndarray) -> FeatureContributionExplainer:
        """Compute normal reference distribution parameters from training features."""
        self.baseline_means = np.nanmean(X, axis=0)
        self.baseline_stds = np.nanstd(X, axis=0)
        self.baseline_stds = np.maximum(self.baseline_stds, 1e-4)
        return self

    def explain_sample(
        self,
        sample_vec: np.ndarray,
        sample_index: int,
        anomaly_score: float,
        is_anomaly: bool,
        top_k: int = 3,
        reconstruction_errors: Optional[np.ndarray] = None,
    ) -> AnomalyExplanation:
        """Explain an individual anomalous sensor observation."""
        n_features = len(self.feature_names)
        vec = sample_vec.reshape(-1)

        if reconstruction_errors is not None:
            # Use autoencoder reconstruction errors directly
            raw_contribs = reconstruction_errors.reshape(-1)
        elif self.baseline_means is not None and self.baseline_stds is not None:
            # Normalized z-score deviation from training baseline
            raw_contribs = np.abs((vec - self.baseline_means) / self.baseline_stds)
        else:
            raw_contribs = np.abs(vec)

        total = np.sum(raw_contribs)
        relative_weights = (raw_contribs / total) if total > 1e-9 else np.ones(n_features) / n_features

        # Sort features by contribution descending
        sorted_indices = np.argsort(-raw_contribs)[:top_k]

        top_features: List[Dict[str, Any]] = []
        for idx in sorted_indices:
            feat_name = self.feature_names[idx] if idx < len(self.feature_names) else f"feat_{idx}"
            top_features.append({
                "feature": feat_name,
                "observed_value": float(vec[idx]),
                "baseline_mean": float(self.baseline_means[idx]) if self.baseline_means is not None else None,
                "relative_importance": float(relative_weights[idx]),
                "deviation_score": float(raw_contribs[idx]),
            })

        if is_anomaly and top_features:
            primary_cause = top_features[0]
            summary = (
                f"Flagged as anomaly (score: {anomaly_score:.3f}). "
                f"Primary contributor '{primary_cause['feature']}' observed at {primary_cause['observed_value']:.2f} "
                f"accounts for {primary_cause['relative_importance']:.1%} of overall deviation."
            )
        else:
            summary = f"Normal telemetry reading (score: {anomaly_score:.3f}). Within baseline tolerance."

        return AnomalyExplanation(
            sample_index=sample_index,
            anomaly_score=anomaly_score,
            is_anomaly=is_anomaly,
            top_contributing_features=top_features,
            summary=summary,
        )
