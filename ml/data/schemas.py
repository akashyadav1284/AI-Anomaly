"""Common data schemas, types, and metadata definitions for IoT anomaly detection datasets."""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
import pandas as pd


class AnomalyType(str, Enum):
    """Standardized anomaly taxonomy supported by the platform."""
    NONE = "none"
    POINT_SPIKE = "point_spike"
    CONTEXTUAL = "contextual"
    COLLECTIVE = "collective"
    GRADUAL_DRIFT = "gradual_drift"
    STUCK_SENSOR = "stuck_sensor"
    NOISE_BURST = "noise_burst"
    MISSING_CORRUPTED = "missing_corrupted"


class OperatingRegime(str, Enum):
    """Operational modes influencing sensor baselines and variance."""
    IDLE = "idle"
    NORMAL_LOAD = "normal_load"
    HIGH_STRESS = "high_stress"
    MAINTENANCE = "maintenance"


# Core column names defined in common schema
COL_TIMESTAMP = "timestamp"
COL_DEVICE_ID = "device_id"
COL_DATASET_ID = "dataset_id"
COL_GROUND_TRUTH = "ground_truth_is_anomaly"
COL_ANOMALY_TYPE = "anomaly_type"
COL_EVENT_ID = "event_id"

METADATA_COLUMNS = {
    COL_TIMESTAMP,
    COL_DEVICE_ID,
    COL_DATASET_ID,
    COL_GROUND_TRUTH,
    COL_ANOMALY_TYPE,
    COL_EVENT_ID,
}


@dataclass
class DatasetMetadata:
    """Standardized metadata sidecar schema tracking dataset provenance and characteristics."""
    dataset_name: str
    dataset_id: str
    source: str
    description: str
    created_at: str
    row_count: int
    column_count: int
    devices: List[str]
    feature_names: List[str]
    timestamp_start: Optional[str] = None
    timestamp_end: Optional[str] = None
    sampling_frequency: Optional[str] = None
    label_availability: bool = False
    anomaly_counts: Dict[str, int] = field(default_factory=dict)
    checksum_sha256: Optional[str] = None
    license_or_access_notes: str = "Research and internal development only."
    preprocessing_history: List[Dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def extract_features(df: pd.DataFrame, extra_exclude: Optional[List[str]] = None) -> List[str]:
    """Return numeric measurement feature column names excluding metadata and target columns."""
    exclude = set(METADATA_COLUMNS)
    if extra_exclude:
        exclude.update(extra_exclude)
    return [col for col in df.columns if col not in exclude]
