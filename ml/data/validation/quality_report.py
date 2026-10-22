"""Quality reporting utility generating structured JSON summaries and text audit logs."""
from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Union
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
from ml.data.validation.schema_validation import DatasetSchemaValidator, ValidationResult


@dataclass
class QualityReport:
    """Structured report detailing summary statistics, distribution, and validation issues."""
    generated_at: str
    row_count: int
    column_count: int
    devices: List[str]
    device_count: int
    features: List[str]
    feature_count: int
    timestamp_start: Optional[str]
    timestamp_end: Optional[str]
    time_span_seconds: Optional[float]
    median_sampling_interval_seconds: Optional[float]
    missing_values_by_column: Dict[str, int]
    duplicate_rows_count: int
    anomaly_summary: Dict[str, Any]
    is_valid: bool
    errors: List[Dict[str, Any]]
    warnings: List[Dict[str, Any]]

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    def to_json(self, indent: int = 2) -> str:
        return json.dumps(self.to_dict(), indent=indent)

    def save(self, filepath: Union[str, Path]) -> None:
        p = Path(filepath)
        p.parent.mkdir(parents=True, exist_ok=True)
        with open(p, "w", encoding="utf-8") as f:
            f.write(self.to_json())


class QualityReporter:
    """Generates quality reports from IoT time-series datasets."""

    def __init__(self, validator: Optional[DatasetSchemaValidator] = None):
        self.validator = validator or DatasetSchemaValidator()

    def generate_report(self, df: pd.DataFrame) -> QualityReport:
        val_result = self.validator.validate(df)

        features = extract_features(df)
        devices = sorted(df[COL_DEVICE_ID].unique().tolist()) if COL_DEVICE_ID in df.columns else []

        ts_start = None
        ts_end = None
        time_span = None
        median_interval = None

        if COL_TIMESTAMP in df.columns and pd.api.types.is_datetime64_any_dtype(df[COL_TIMESTAMP]):
            valid_ts = df[COL_TIMESTAMP].dropna()
            if not valid_ts.empty:
                ts_start = valid_ts.min().isoformat()
                ts_end = valid_ts.max().isoformat()
                time_span = (valid_ts.max() - valid_ts.min()).total_seconds()
                diffs = valid_ts.sort_values().diff().dt.total_seconds().dropna()
                if not diffs.empty:
                    median_interval = float(diffs.median())

        missing = {col: int(df[col].isna().sum()) for col in df.columns}
        dupe_count = int(df.duplicated().sum())

        anomaly_summary: Dict[str, Any] = {
            "has_ground_truth": COL_GROUND_TRUTH in df.columns,
            "total_anomalies": int(df[COL_GROUND_TRUTH].sum()) if COL_GROUND_TRUTH in df.columns else 0,
            "anomaly_ratio": float(df[COL_GROUND_TRUTH].mean()) if COL_GROUND_TRUTH in df.columns else 0.0,
            "breakdown_by_type": df[COL_ANOMALY_TYPE].value_counts().to_dict() if COL_ANOMALY_TYPE in df.columns else {},
        }

        return QualityReport(
            generated_at=datetime.now(timezone.utc).isoformat(),
            row_count=len(df),
            column_count=len(df.columns),
            devices=devices,
            device_count=len(devices),
            features=features,
            feature_count=len(features),
            timestamp_start=ts_start,
            timestamp_end=ts_end,
            time_span_seconds=time_span,
            median_sampling_interval_seconds=median_interval,
            missing_values_by_column=missing,
            duplicate_rows_count=dupe_count,
            anomaly_summary=anomaly_summary,
            is_valid=val_result.is_valid,
            errors=[asdict(e) for e in val_result.errors],
            warnings=[asdict(w) for w in val_result.warnings],
        )
