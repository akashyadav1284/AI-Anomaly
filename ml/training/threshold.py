"""Reusable threshold calibration module for unsupervised, quantile, and supervised calibration."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Tuple
import numpy as np


@dataclass
class ThresholdCalibrationResult:
    """Outcome of threshold calibration on validation scores."""
    threshold: float
    method: str
    target_value: float
    description: str


class ThresholdCalibrator:
    """Computes decision thresholds for normalized anomaly scores in [0.0, 1.0]."""

    @staticmethod
    def calibrate_by_quantile(
        scores: np.ndarray,
        quantile: float = 0.95,
    ) -> ThresholdCalibrationResult:
        """Calibrate threshold based on score quantile (e.g., 0.95 flags top 5% as anomalous)."""
        if not (0.0 < quantile < 1.0):
            raise ValueError(f"Quantile must be in (0, 1), got {quantile}")

        val = float(np.quantile(scores, quantile))
        return ThresholdCalibrationResult(
            threshold=val,
            method="quantile",
            target_value=quantile,
            description=f"Top {100 * (1 - quantile):.1f}% most anomalous validation scores flagged.",
        )

    @staticmethod
    def calibrate_by_contamination(
        scores: np.ndarray,
        contamination: float = 0.03,
    ) -> ThresholdCalibrationResult:
        """Calibrate threshold to match estimated contamination rate."""
        q = 1.0 - contamination
        return ThresholdCalibrator.calibrate_by_quantile(scores, quantile=q)

    @staticmethod
    def calibrate_by_f1_score(
        scores: np.ndarray,
        y_true: np.ndarray,
        search_steps: int = 100,
    ) -> ThresholdCalibrationResult:
        """Select threshold maximizing validation F1 score when true labels are available."""
        y_arr = np.asarray(y_true, dtype=int)
        if len(np.unique(y_arr)) < 2:
            # Fall back to quantile if only normal rows exist in validation set
            return ThresholdCalibrator.calibrate_by_quantile(scores, quantile=0.97)

        thresholds = np.linspace(np.min(scores), np.max(scores), search_steps)
        best_f1 = -1.0
        best_t = float(np.median(scores))

        for t in thresholds:
            y_pred = (scores >= t).astype(int)
            tp = np.sum((y_pred == 1) & (y_arr == 1))
            fp = np.sum((y_pred == 1) & (y_arr == 0))
            fn = np.sum((y_pred == 0) & (y_arr == 1))

            precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
            recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
            f1 = (2 * precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0

            if f1 > best_f1:
                best_f1 = f1
                best_t = float(t)

        return ThresholdCalibrationResult(
            threshold=best_t,
            method="f1_optimal",
            target_value=float(best_f1),
            description=f"Optimal validation F1-score ({best_f1:.4f}) threshold.",
        )
