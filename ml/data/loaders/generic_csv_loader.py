"""Generic configurable CSV time-series dataset loader."""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Union
import pandas as pd
from ml.data.loaders.base import BaseDatasetLoader, LoadedDataset
from ml.data.schemas import (
    AnomalyType,
    COL_ANOMALY_TYPE,
    COL_DATASET_ID,
    COL_DEVICE_ID,
    COL_EVENT_ID,
    COL_GROUND_TRUTH,
    COL_TIMESTAMP,
    DatasetMetadata,
    extract_features,
)


class GenericCSVLoader(BaseDatasetLoader):
    """Imports arbitrary CSV telemetry files, normalizing timestamps and column mappings."""

    def __init__(
        self,
        timestamp_col: str,
        device_id_col: Optional[str] = None,
        default_device_id: str = "device_default",
        dataset_id: str = "generic_csv",
        feature_cols: Optional[List[str]] = None,
        label_col: Optional[str] = None,
        anomaly_type_col: Optional[str] = None,
        event_id_col: Optional[str] = None,
        timestamp_format: Optional[str] = None,
        timestamp_tz: str = "UTC",
    ):
        self.timestamp_col = timestamp_col
        self.device_id_col = device_id_col
        self.default_device_id = default_device_id
        self.dataset_id = dataset_id
        self.feature_cols = feature_cols
        self.label_col = label_col
        self.anomaly_type_col = anomaly_type_col
        self.event_id_col = event_id_col
        self.timestamp_format = timestamp_format
        self.timestamp_tz = timestamp_tz

    def load(self, source_path: Union[str, Path]) -> LoadedDataset:
        path = Path(source_path)
        if not path.exists():
            raise FileNotFoundError(f"Source file not found at: {path}")

        raw_df = pd.read_csv(path)
        if self.timestamp_col not in raw_df.columns:
            raise ValueError(f"Required timestamp column '{self.timestamp_col}' not found in CSV.")

        # Parse timestamps into timezone-aware UTC datetime
        try:
            parsed_timestamps = pd.to_datetime(
                raw_df[self.timestamp_col],
                format=self.timestamp_format,
                utc=True,
            )
        except Exception as e:
            raise ValueError(f"Failed to parse timestamp column '{self.timestamp_col}': {e}")

        # Assemble normalized dataframe
        norm_df = pd.DataFrame()
        norm_df[COL_TIMESTAMP] = parsed_timestamps

        if self.device_id_col and self.device_id_col in raw_df.columns:
            norm_df[COL_DEVICE_ID] = raw_df[self.device_id_col].astype(str)
        else:
            norm_df[COL_DEVICE_ID] = self.default_device_id

        norm_df[COL_DATASET_ID] = self.dataset_id

        # Determine features
        if self.feature_cols:
            missing_features = [f for f in self.feature_cols if f not in raw_df.columns]
            if missing_features:
                raise ValueError(f"Configured feature columns missing from CSV: {missing_features}")
            target_features = self.feature_cols
        else:
            exclude = {self.timestamp_col}
            if self.device_id_col:
                exclude.add(self.device_id_col)
            if self.label_col:
                exclude.add(self.label_col)
            if self.anomaly_type_col:
                exclude.add(self.anomaly_type_col)
            if self.event_id_col:
                exclude.add(self.event_id_col)
            target_features = [c for c in raw_df.columns if c not in exclude]

        # Validate numeric features and convert safely
        for feat in target_features:
            norm_df[feat] = pd.to_numeric(raw_df[feat], errors="coerce")

        # Map labels
        if self.label_col and self.label_col in raw_df.columns:
            norm_df[COL_GROUND_TRUTH] = pd.to_numeric(raw_df[self.label_col], errors="coerce").fillna(0).astype(int)
        else:
            norm_df[COL_GROUND_TRUTH] = 0

        if self.anomaly_type_col and self.anomaly_type_col in raw_df.columns:
            norm_df[COL_ANOMALY_TYPE] = raw_df[self.anomaly_type_col].fillna(AnomalyType.NONE.value).astype(str)
        else:
            norm_df[COL_ANOMALY_TYPE] = norm_df[COL_GROUND_TRUTH].apply(
                lambda v: "unspecified_anomaly" if v == 1 else AnomalyType.NONE.value
            )

        if self.event_id_col and self.event_id_col in raw_df.columns:
            norm_df[COL_EVENT_ID] = raw_df[self.event_id_col].where(pd.notnull(raw_df[self.event_id_col]), None)
        else:
            norm_df[COL_EVENT_ID] = None

        # Sort chronologically
        norm_df = norm_df.sort_values(by=[COL_TIMESTAMP, COL_DEVICE_ID]).reset_index(drop=True)

        features = extract_features(norm_df)
        devices = sorted(norm_df[COL_DEVICE_ID].unique().tolist())

        anomaly_counts: Dict[str, int] = norm_df[COL_ANOMALY_TYPE].value_counts().to_dict()

        metadata = DatasetMetadata(
            dataset_name=path.stem,
            dataset_id=self.dataset_id,
            source=str(path),
            description="Dataset imported via GenericCSVLoader",
            created_at=datetime.now(timezone.utc).isoformat(),
            row_count=len(norm_df),
            column_count=len(norm_df.columns),
            devices=devices,
            feature_names=features,
            timestamp_start=norm_df[COL_TIMESTAMP].min().isoformat() if len(norm_df) > 0 else None,
            timestamp_end=norm_df[COL_TIMESTAMP].max().isoformat() if len(norm_df) > 0 else None,
            label_availability=self.label_col is not None,
            anomaly_counts=anomaly_counts,
        )

        return LoadedDataset(data=norm_df, metadata=metadata)
