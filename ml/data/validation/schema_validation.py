"""Dataset schema validation rules and automated integrity assertions."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional, Set
import numpy as np
import pandas as pd
from ml.data.schemas import (
    COL_ANOMALY_TYPE,
    COL_DATASET_ID,
    COL_DEVICE_ID,
    COL_GROUND_TRUTH,
    COL_TIMESTAMP,
    extract_features,
)


@dataclass
class ValidationIssue:
    """Individual data quality warning or error."""
    severity: str  # 'ERROR' or 'WARNING'
    check_name: str
    message: str
    column: Optional[str] = None
    affected_count: int = 0


@dataclass
class ValidationResult:
    """Aggregated validation output containing issue list and boolean success flag."""
    is_valid: bool
    errors: List[ValidationIssue] = field(default_factory=list)
    warnings: List[ValidationIssue] = field(default_factory=list)

    @property
    def issues(self) -> List[ValidationIssue]:
        return self.errors + self.warnings


class DatasetSchemaValidator:
    """Validates dataframes against common IoT anomaly detection schema and physical consistency rules."""

    REQUIRED_COLUMNS: Set[str] = {
        COL_TIMESTAMP,
        COL_DEVICE_ID,
        COL_DATASET_ID,
    }

    def __init__(self, check_infinite: bool = True, max_allowed_missing_ratio: float = 0.2):
        self.check_infinite = check_infinite
        self.max_allowed_missing_ratio = max_allowed_missing_ratio

    def validate(self, df: pd.DataFrame) -> ValidationResult:
        errors: List[ValidationIssue] = []
        warnings: List[ValidationIssue] = []

        if df.empty:
            errors.append(
                ValidationIssue(
                    severity="ERROR",
                    check_name="empty_dataset",
                    message="Dataset contains 0 rows.",
                )
            )
            return ValidationResult(is_valid=False, errors=errors, warnings=warnings)

        # 1. Required columns
        missing_required = self.REQUIRED_COLUMNS - set(df.columns)
        if missing_required:
            errors.append(
                ValidationIssue(
                    severity="ERROR",
                    check_name="missing_required_columns",
                    message=f"Missing required metadata columns: {sorted(list(missing_required))}",
                )
            )

        # 2. Timestamp checks
        if COL_TIMESTAMP in df.columns:
            ts_series = df[COL_TIMESTAMP]
            if not pd.api.types.is_datetime64_any_dtype(ts_series):
                errors.append(
                    ValidationIssue(
                        severity="ERROR",
                        check_name="invalid_timestamp_dtype",
                        message="Timestamp column must be datetime64 type.",
                        column=COL_TIMESTAMP,
                    )
                )
            else:
                # Check for NaT timestamps
                nat_count = ts_series.isna().sum()
                if nat_count > 0:
                    errors.append(
                        ValidationIssue(
                            severity="ERROR",
                            check_name="null_timestamps",
                            message=f"Found {nat_count} null or unparseable timestamps.",
                            column=COL_TIMESTAMP,
                            affected_count=int(nat_count),
                        )
                    )

                # Check chronological order per device
                if COL_DEVICE_ID in df.columns:
                    for dev_id, group in df.groupby(COL_DEVICE_ID):
                        dev_ts = group[COL_TIMESTAMP].dropna()
                        if not dev_ts.is_monotonic_increasing:
                            errors.append(
                                ValidationIssue(
                                    severity="ERROR",
                                    check_name="out_of_order_timestamps",
                                    message=f"Timestamps for device '{dev_id}' are not monotonically increasing.",
                                    column=COL_TIMESTAMP,
                                )
                            )

                # Check duplicate (timestamp, device_id)
                if COL_DEVICE_ID in df.columns:
                    dupe_keys = df.duplicated(subset=[COL_TIMESTAMP, COL_DEVICE_ID]).sum()
                    if dupe_keys > 0:
                        errors.append(
                            ValidationIssue(
                                severity="ERROR",
                                check_name="duplicate_timestamps_per_device",
                                message=f"Found {dupe_keys} duplicate (timestamp, device_id) pairs.",
                                affected_count=int(dupe_keys),
                            )
                        )

        # 3. Numeric feature checks
        features = extract_features(df)
        if not features:
            warnings.append(
                ValidationIssue(
                    severity="WARNING",
                    check_name="no_features",
                    message="No numeric feature channels detected.",
                )
            )

        for feat in features:
            col_series = df[feat]
            if not pd.api.types.is_numeric_dtype(col_series):
                errors.append(
                    ValidationIssue(
                        severity="ERROR",
                        check_name="non_numeric_feature",
                        message=f"Feature '{feat}' has non-numeric dtype: {col_series.dtype}",
                        column=feat,
                    )
                )
                continue

            # Check null ratio
            null_count = col_series.isna().sum()
            null_ratio = null_count / len(df)
            if null_ratio > self.max_allowed_missing_ratio:
                warnings.append(
                    ValidationIssue(
                        severity="WARNING",
                        check_name="high_missing_ratio",
                        message=f"Feature '{feat}' has high missing ratio ({null_ratio:.1%}).",
                        column=feat,
                        affected_count=int(null_count),
                    )
                )

            # Check infinite values
            if self.check_infinite:
                inf_count = np.isinf(col_series.dropna().to_numpy()).sum()
                if inf_count > 0:
                    errors.append(
                        ValidationIssue(
                            severity="ERROR",
                            check_name="infinite_values",
                            message=f"Feature '{feat}' contains {inf_count} infinite values.",
                            column=feat,
                            affected_count=int(inf_count),
                        )
                    )

            # Check constant channels
            valid_vals = col_series.dropna()
            if len(valid_vals) > 1 and valid_vals.nunique() == 1:
                warnings.append(
                    ValidationIssue(
                        severity="WARNING",
                        check_name="constant_channel",
                        message=f"Feature '{feat}' is constant (zero variance). Value: {valid_vals.iloc[0]}",
                        column=feat,
                    )
                )

        # 4. Label validity
        if COL_GROUND_TRUTH in df.columns:
            valid_labels = df[COL_GROUND_TRUTH].dropna().isin([0, 1]).all()
            if not valid_labels:
                errors.append(
                    ValidationIssue(
                        severity="ERROR",
                        check_name="invalid_ground_truth_labels",
                        message="ground_truth_is_anomaly must contain binary labels (0 or 1).",
                        column=COL_GROUND_TRUTH,
                    )
                )

        is_valid = len(errors) == 0
        return ValidationResult(is_valid=is_valid, errors=errors, warnings=warnings)
