"""Loader for Numenta Anomaly Benchmark (NAB) formatted datasets and window annotations."""
from __future__ import annotations

import json
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


class NABLoader(BaseDatasetLoader):
    """Imports Numenta Anomaly Benchmark time-series files and maps anomaly window labels."""

    def __init__(
        self,
        dataset_id: str = "nab_benchmark",
        default_device_id: Optional[str] = None,
    ):
        self.dataset_id = dataset_id
        self.default_device_id = default_device_id

    def load(
        self,
        source_path: Union[str, Path],
        labels_json_path: Optional[Union[str, Path]] = None,
    ) -> LoadedDataset:
        path = Path(source_path)
        if not path.exists():
            raise FileNotFoundError(f"NAB file not found at: {path}")

        raw_df = pd.read_csv(path)

        # Standard NAB format contains: 'timestamp' and a single metric value column (e.g. 'value')
        if "timestamp" not in raw_df.columns:
            raise ValueError(f"NAB file missing 'timestamp' column: {path}")

        parsed_ts = pd.to_datetime(raw_df["timestamp"], utc=True)

        norm_df = pd.DataFrame()
        norm_df[COL_TIMESTAMP] = parsed_ts

        device_name = self.default_device_id or path.stem
        norm_df[COL_DEVICE_ID] = device_name
        norm_df[COL_DATASET_ID] = self.dataset_id

        # Copy numeric metric channels
        metric_cols = [c for c in raw_df.columns if c != "timestamp"]
        for col in metric_cols:
            norm_df[col] = pd.to_numeric(raw_df[col], errors="coerce")

        norm_df[COL_GROUND_TRUTH] = 0
        norm_df[COL_ANOMALY_TYPE] = AnomalyType.NONE.value
        norm_df[COL_EVENT_ID] = None

        # Parse NAB anomaly window annotations if provided
        windows_found = False
        if labels_json_path:
            l_path = Path(labels_json_path)
            if l_path.exists():
                with open(l_path, "r", encoding="utf-8") as f:
                    label_data = json.load(f)

                # Key could be relative path or file name
                rel_keys = [k for k in label_data if path.name in k]
                if rel_keys:
                    windows = label_data[rel_keys[0]]
                    windows_found = True
                    for w_idx, win in enumerate(windows):
                        if len(win) == 2:
                            w_start = pd.to_datetime(win[0], utc=True)
                            w_end = pd.to_datetime(win[1], utc=True)
                            mask = (norm_df[COL_TIMESTAMP] >= w_start) & (norm_df[COL_TIMESTAMP] <= w_end)
                            if mask.any():
                                norm_df.loc[mask, COL_GROUND_TRUTH] = 1
                                norm_df.loc[mask, COL_ANOMALY_TYPE] = AnomalyType.COLLECTIVE.value
                                norm_df.loc[mask, COL_EVENT_ID] = f"NAB_WIN_{w_idx:03d}"

        norm_df = norm_df.sort_values(by=COL_TIMESTAMP).reset_index(drop=True)
        features = extract_features(norm_df)

        metadata = DatasetMetadata(
            dataset_name=f"NAB_{path.stem}",
            dataset_id=self.dataset_id,
            source=str(path),
            description="Numenta Anomaly Benchmark time-series data.",
            created_at=datetime.now(timezone.utc).isoformat(),
            row_count=len(norm_df),
            column_count=len(norm_df.columns),
            devices=[device_name],
            feature_names=features,
            timestamp_start=norm_df[COL_TIMESTAMP].min().isoformat() if len(norm_df) > 0 else None,
            timestamp_end=norm_df[COL_TIMESTAMP].max().isoformat() if len(norm_df) > 0 else None,
            label_availability=windows_found,
            anomaly_counts=norm_df[COL_ANOMALY_TYPE].value_counts().to_dict(),
            license_or_access_notes="AGPL-3.0 License. Research provenance: Numenta.",
        )

        return LoadedDataset(data=norm_df, metadata=metadata)
