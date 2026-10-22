"""Causal time-series feature engineering avoiding future leakage."""
from __future__ import annotations

from typing import List, Optional
import pandas as pd
from ml.data.schemas import (
    COL_DEVICE_ID,
    extract_features,
)


class TimeSeriesFeatureEngineer:
    """Extracts rolling window, lag, difference, and rate-of-change features in a strictly causal manner."""

    def __init__(
        self,
        rolling_windows: Optional[List[int]] = None,
        lag_steps: Optional[List[int]] = None,
        include_differences: bool = True,
        include_rolling_std: bool = True,
    ):
        self.rolling_windows = rolling_windows or [5, 15]
        self.lag_steps = lag_steps or [1, 2]
        self.include_differences = include_differences
        self.include_rolling_std = include_rolling_std

    def transform(self, df: pd.DataFrame) -> pd.DataFrame:
        """Compute causal features per device without future leakage."""
        df_out = df.copy()
        raw_features = extract_features(df_out)

        def _process_group(group: pd.DataFrame) -> pd.DataFrame:
            res = group.copy()
            for feat in raw_features:
                # Lag features: y(t - k)
                for lag in self.lag_steps:
                    res[f"{feat}_lag_{lag}"] = group[feat].shift(lag)

                # First differences: y(t) - y(t - 1)
                if self.include_differences:
                    res[f"{feat}_diff_1"] = group[feat].diff(1)

                # Strictly causal rolling statistics
                for w in self.rolling_windows:
                    # min_periods=1 prevents dropping initial sequence steps
                    res[f"{feat}_roll_mean_{w}"] = group[feat].rolling(window=w, min_periods=1).mean()
                    if self.include_rolling_std:
                        res[f"{feat}_roll_std_{w}"] = group[feat].rolling(window=w, min_periods=1).std().fillna(0.0)

            return res

        if COL_DEVICE_ID in df_out.columns:
            # Apply per device to ensure no lag or rolling window bleeds across separate physical devices
            df_out = df_out.groupby(COL_DEVICE_ID, group_keys=False).apply(_process_group)
        else:
            df_out = _process_group(df_out)

        return df_out
