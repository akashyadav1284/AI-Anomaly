"""Leakage-resistant chronological and device-grouped dataset splitting."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple
import pandas as pd
from ml.data.schemas import (
    COL_DEVICE_ID,
    COL_TIMESTAMP,
)
from ml.data.validation.leakage_checks import (
    check_device_leakage,
    check_temporal_leakage,
)


@dataclass
class DatasetSplits:
    """Container holding partitioned dataframes alongside boundary metadata."""
    train: pd.DataFrame
    test: pd.DataFrame
    val: Optional[pd.DataFrame] = None
    strategy: str = "chronological"
    train_devices: Optional[List[str]] = None
    test_devices: Optional[List[str]] = None
    train_end_ts: Optional[str] = None
    test_start_ts: Optional[str] = None


class TimeSeriesSplitter:
    """Splits multi-device time series according to chronological boundaries or device holdouts."""

    @staticmethod
    def chronological_split(
        df: pd.DataFrame,
        train_ratio: float = 0.7,
        val_ratio: float = 0.15,
        test_ratio: float = 0.15,
    ) -> DatasetSplits:
        """Partition observations strictly chronologically per device or globally."""
        if not (0.99 <= (train_ratio + val_ratio + test_ratio) <= 1.01):
            raise ValueError("Split ratios must sum to 1.0")

        # Sort first
        df_sorted = df.sort_values(by=COL_TIMESTAMP).reset_index(drop=True)

        n = len(df_sorted)
        train_end = int(n * train_ratio)
        val_end = int(n * (train_ratio + val_ratio))

        train_df = df_sorted.iloc[:train_end].copy()
        val_df = df_sorted.iloc[train_end:val_end].copy() if val_ratio > 0 else None
        test_df = df_sorted.iloc[val_end:].copy()

        # Check for temporal leakage
        leakage = check_temporal_leakage(train_df, test_df, val_df)
        if leakage.has_leakage:
            raise RuntimeError(f"Split produced temporal leakage: {leakage.findings}")

        return DatasetSplits(
            train=train_df,
            test=test_df,
            val=val_df,
            strategy="chronological",
            train_end_ts=train_df[COL_TIMESTAMP].max().isoformat() if not train_df.empty else None,
            test_start_ts=test_df[COL_TIMESTAMP].min().isoformat() if not test_df.empty else None,
        )

    @staticmethod
    def device_holdout_split(
        df: pd.DataFrame,
        test_devices: List[str],
    ) -> DatasetSplits:
        """Partition dataset such that selected devices are exclusively evaluated in test set."""
        if COL_DEVICE_ID not in df.columns:
            raise ValueError(f"Column '{COL_DEVICE_ID}' required for device holdout split.")

        train_mask = ~df[COL_DEVICE_ID].isin(test_devices)
        test_mask = df[COL_DEVICE_ID].isin(test_devices)

        train_df = df[train_mask].copy().reset_index(drop=True)
        test_df = df[test_mask].copy().reset_index(drop=True)

        leakage = check_device_leakage(train_df, test_df)
        if leakage.has_leakage:
            raise RuntimeError(f"Device holdout leakage detected: {leakage.findings}")

        return DatasetSplits(
            train=train_df,
            test=test_df,
            strategy="device_holdout",
            train_devices=sorted(list(train_df[COL_DEVICE_ID].unique())),
            test_devices=sorted(test_devices),
        )
