"""Data leakage checks for time-series splits and feature sets."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional
import pandas as pd
from ml.data.schemas import (
    COL_DEVICE_ID,
    COL_TIMESTAMP,
    METADATA_COLUMNS,
)


@dataclass
class LeakageCheckResult:
    """Outcome of temporal, device, and target feature leakage checks."""
    has_leakage: bool
    findings: List[str] = field(default_factory=list)


def check_temporal_leakage(
    train_df: pd.DataFrame,
    test_df: pd.DataFrame,
    val_df: Optional[pd.DataFrame] = None,
) -> LeakageCheckResult:
    """Ensure training observations strictly precede validation, which precedes test data."""
    findings: List[str] = []

    if train_df.empty or test_df.empty:
        return LeakageCheckResult(has_leakage=False, findings=["Empty split supplied; skipped."])

    train_max_ts = train_df[COL_TIMESTAMP].max()
    test_min_ts = test_df[COL_TIMESTAMP].min()

    if train_max_ts >= test_min_ts:
        findings.append(
            f"Temporal Leakage: Training max timestamp ({train_max_ts}) is >= Test min timestamp ({test_min_ts})."
        )

    if val_df is not None and not val_df.empty:
        val_min_ts = val_df[COL_TIMESTAMP].min()
        val_max_ts = val_df[COL_TIMESTAMP].max()

        if train_max_ts >= val_min_ts:
            findings.append(
                f"Temporal Leakage: Training max timestamp ({train_max_ts}) >= Validation min timestamp ({val_min_ts})."
            )
        if val_max_ts >= test_min_ts:
            findings.append(
                f"Temporal Leakage: Validation max timestamp ({val_max_ts}) >= Test min timestamp ({test_min_ts})."
            )

    return LeakageCheckResult(has_leakage=len(findings) > 0, findings=findings)


def check_device_leakage(
    train_df: pd.DataFrame,
    held_out_df: pd.DataFrame,
) -> LeakageCheckResult:
    """Ensure devices selected for held-out evaluation do not appear in the training partition."""
    findings: List[str] = []
    if COL_DEVICE_ID not in train_df.columns or COL_DEVICE_ID not in held_out_df.columns:
        return LeakageCheckResult(has_leakage=False)

    train_devices = set(train_df[COL_DEVICE_ID].unique())
    held_out_devices = set(held_out_df[COL_DEVICE_ID].unique())

    overlap = train_devices.intersection(held_out_devices)
    if overlap:
        findings.append(
            f"Device Leakage: Held-out devices present in training set: {sorted(list(overlap))}"
        )

    return LeakageCheckResult(has_leakage=len(findings) > 0, findings=findings)


def check_target_leakage_in_features(
    feature_columns: List[str],
) -> LeakageCheckResult:
    """Assert that label or identifier columns never enter the ML numeric feature matrix."""
    findings: List[str] = []
    forbidden = set(METADATA_COLUMNS)
    leakage = forbidden.intersection(set(feature_columns))

    if leakage:
        findings.append(
            f"Target/Metadata Leakage: Forbidden metadata columns found in model feature set: {sorted(list(leakage))}"
        )

    return LeakageCheckResult(has_leakage=len(findings) > 0, findings=findings)
