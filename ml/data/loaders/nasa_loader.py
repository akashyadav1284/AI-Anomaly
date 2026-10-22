"""Loader for NASA SMAP / MSL telemetry benchmark datasets (telemanom)."""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, List, Optional, Union
import numpy as np
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


class NASALoader(BaseDatasetLoader):
    """Imports NASA SMAP/MSL spacecraft telemetry matrices (.npy or .csv) and labels."""

    def __init__(
        self,
        dataset_id: str = "nasa_smap_msl",
        channel_id: Optional[str] = None,
        base_timestamp: Optional[datetime] = None,
        sampling_seconds: float = 60.0,
    ):
        self.dataset_id = dataset_id
        self.channel_id = channel_id
        self.base_timestamp = base_timestamp or datetime(2018, 1, 1, 0, 0, tzinfo=timezone.utc)
        self.sampling_seconds = sampling_seconds

    def load(
        self,
        source_path: Union[str, Path],
        anomaly_intervals: Optional[List[List[int]]] = None,
    ) -> LoadedDataset:
        """Load telemetry array (.npy or .csv).
        
        Note on timestamps:
        NASA SMAP/MSL benchmark sequences (Hundman et al.) contain discrete telemetry steps without
        absolute UTC calendar dates. This loader reconstructs uniform synthetic timestamps starting
        from base_timestamp to provide consistent time-series indexing.
        """
        path = Path(source_path)
        if not path.exists():
            raise FileNotFoundError(f"NASA telemetry file not found: {path}")

        chan_name = self.channel_id or path.stem

        if path.suffix.lower() == ".npy":
            arr = np.load(path)
            if arr.ndim == 1:
                arr = arr.reshape(-1, 1)
        elif path.suffix.lower() == ".csv":
            df_in = pd.read_csv(path)
            # Exclude non-numeric columns if present
            arr = df_in.select_dtypes(include=[np.number]).values
        else:
            raise ValueError(f"Unsupported file format for NASA loader: {path.suffix}. Expected .npy or .csv")

        n_rows, n_cols = arr.shape

        # Reconstruct uniform time index
        timestamps = [
            self.base_timestamp + timedelta(seconds=i * self.sampling_seconds)
            for i in range(n_rows)
        ]

        norm_df = pd.DataFrame()
        norm_df[COL_TIMESTAMP] = timestamps
        norm_df[COL_DEVICE_ID] = chan_name
        norm_df[COL_DATASET_ID] = self.dataset_id

        # Name channels (chan_val_0 is the primary command/metric, chan_cmd_1... are inputs)
        for c in range(n_cols):
            feat_name = f"{chan_name}_val" if c == 0 else f"{chan_name}_ch_{c}"
            norm_df[feat_name] = arr[:, c].astype(float)

        norm_df[COL_GROUND_TRUTH] = 0
        norm_df[COL_ANOMALY_TYPE] = AnomalyType.NONE.value
        norm_df[COL_EVENT_ID] = None

        has_labels = False
        if anomaly_intervals:
            has_labels = True
            for ev_idx, interval in enumerate(anomaly_intervals):
                if len(interval) == 2:
                    st, en = interval
                    st = max(0, int(st))
                    en = min(n_rows, int(en))
                    if st < en:
                        norm_df.loc[st:en, COL_GROUND_TRUTH] = 1
                        norm_df.loc[st:en, COL_ANOMALY_TYPE] = AnomalyType.COLLECTIVE.value
                        norm_df.loc[st:en, COL_EVENT_ID] = f"NASA_EVT_{ev_idx:03d}"

        features = extract_features(norm_df)

        metadata = DatasetMetadata(
            dataset_name=f"NASA_{chan_name}",
            dataset_id=self.dataset_id,
            source=str(path),
            description="NASA SMAP/MSL spacecraft multi-variate telemetry.",
            created_at=datetime.now(timezone.utc).isoformat(),
            row_count=n_rows,
            column_count=len(norm_df.columns),
            devices=[chan_name],
            feature_names=features,
            timestamp_start=timestamps[0].isoformat() if n_rows > 0 else None,
            timestamp_end=timestamps[-1].isoformat() if n_rows > 0 else None,
            label_availability=has_labels,
            anomaly_counts=norm_df[COL_ANOMALY_TYPE].value_counts().to_dict(),
            license_or_access_notes=(
                "NASA telemanom research benchmark. Discrete time intervals mapped to synthetic UTC."
            ),
        )

        return LoadedDataset(data=norm_df, metadata=metadata)
