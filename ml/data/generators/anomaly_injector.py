"""Anomaly injection engine supporting point, contextual, collective, drift, stuck, noise, and data corruption faults."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional
import numpy as np
import pandas as pd
from ml.data.schemas import (
    AnomalyType,
    COL_ANOMALY_TYPE,
    COL_EVENT_ID,
    COL_GROUND_TRUTH,
    COL_TIMESTAMP,
)


@dataclass
class AnomalyEventConfig:
    """Configuration for a single controlled anomaly injection event."""
    event_id: str
    anomaly_type: AnomalyType
    start_idx: int
    duration: int
    affected_channels: List[str]
    severity: float = 3.0  # Magnitude multiplier or standard deviations
    device_id: Optional[str] = None
    parameters: dict = field(default_factory=dict)


class AnomalyInjector:
    """Injects reproducible, labeled anomalous patterns into multivariate sensor time-series."""

    def __init__(self, random_state: Optional[int] = 42):
        self.random_state = random_state
        self.rng = np.random.default_rng(random_state)

    def inject_anomalies(
        self,
        df: pd.DataFrame,
        configs: List[AnomalyEventConfig],
    ) -> pd.DataFrame:
        """Inject anomaly events into a copy of the input dataframe according to configs.
        
        Guarantees:
        - Labels ground_truth_is_anomaly (0 or 1)
        - Labels anomaly_type (enum string)
        - Labels event_id (string)
        - Non-anomalous rows default to ground_truth_is_anomaly=0, anomaly_type="none", event_id=None
        """
        df_out = df.copy()

        # Initialize label columns if not already present
        if COL_GROUND_TRUTH not in df_out.columns:
            df_out[COL_GROUND_TRUTH] = 0
        if COL_ANOMALY_TYPE not in df_out.columns:
            df_out[COL_ANOMALY_TYPE] = AnomalyType.NONE.value
        if COL_EVENT_ID not in df_out.columns:
            df_out[COL_EVENT_ID] = None

        n_rows = len(df_out)

        for cfg in configs:
            start = cfg.start_idx
            end = min(start + cfg.duration, n_rows)
            if start >= n_rows or start >= end:
                continue

            event_indices = df_out.index[start:end]

            for channel in cfg.affected_channels:
                if channel not in df_out.columns:
                    continue

                orig_values = df_out.loc[event_indices, channel].values
                modified_values = self._apply_anomaly(
                    values=orig_values,
                    anomaly_type=cfg.anomaly_type,
                    severity=cfg.severity,
                    parameters=cfg.parameters,
                )
                df_out.loc[event_indices, channel] = modified_values

            # Record ground-truth labels and event metadata
            df_out.loc[event_indices, COL_GROUND_TRUTH] = 1
            df_out.loc[event_indices, COL_ANOMALY_TYPE] = cfg.anomaly_type.value
            df_out.loc[event_indices, COL_EVENT_ID] = cfg.event_id

        return df_out

    def _apply_anomaly(
        self,
        values: np.ndarray,
        anomaly_type: AnomalyType,
        severity: float,
        parameters: dict,
    ) -> np.ndarray:
        """Apply mathematical transformation for the specified anomaly type."""
        length = len(values)
        if length == 0:
            return values

        arr = values.copy().astype(float)
        std = np.nanstd(arr)
        if std == 0 or np.isnan(std):
            std = 1.0

        if anomaly_type == AnomalyType.POINT_SPIKE:
            # Isolated intense spike on first or chosen index
            spike_idx = parameters.get("spike_idx", 0)
            if spike_idx < length:
                direction = parameters.get("direction", 1.0)
                arr[spike_idx] += direction * severity * std

        elif anomaly_type == AnomalyType.CONTEXTUAL:
            # Replaces active regime value with value plausible globally but inverted contextually
            offset = parameters.get("offset", severity * std * 2.0)
            arr = arr - offset

        elif anomaly_type == AnomalyType.COLLECTIVE:
            # Sustained high-frequency oscillation or square-wave shift
            freq = parameters.get("frequency", 0.2)
            t = np.arange(length)
            wave = np.sin(2 * np.pi * freq * t) * (severity * std)
            arr = arr + wave

        elif anomaly_type == AnomalyType.GRADUAL_DRIFT:
            # Linear baseline drift accumulation over time
            drift_rate = severity * std / max(length, 1)
            t = np.arange(length)
            arr = arr + (drift_rate * t)

        elif anomaly_type == AnomalyType.STUCK_SENSOR:
            # Sensor value locks onto single constant with near-zero noise
            stuck_val = parameters.get("stuck_value", arr[0])
            jitter = self.rng.normal(0, 1e-5, size=length)
            arr = np.full(length, stuck_val) + jitter

        elif anomaly_type == AnomalyType.NOISE_BURST:
            # High-amplitude variance injection
            burst_noise = self.rng.normal(0, severity * std, size=length)
            arr = arr + burst_noise

        elif anomaly_type == AnomalyType.MISSING_CORRUPTED:
            # Drops readings to NaN or injects invalid sentinel values (-999.0)
            mode = parameters.get("mode", "nan")
            if mode == "sentinel":
                arr[:] = -999.0
            else:
                arr[:] = np.nan

        return arr
