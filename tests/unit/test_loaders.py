"""Unit tests for dataset loaders (NAB, NASA, GenericCSV)."""
import json
import pytest
import numpy as np
import pandas as pd
from ml.data.loaders.generic_csv_loader import GenericCSVLoader
from ml.data.loaders.nab_loader import NABLoader
from ml.data.loaders.nasa_loader import NASALoader
from ml.data.schemas import AnomalyType, COL_GROUND_TRUTH, COL_ANOMALY_TYPE


def test_generic_csv_loader(tmp_path):
    """Verify generic CSV loader parses arbitrary formatted sensor files."""
    csv_file = tmp_path / "sensor_data.csv"
    csv_file.write_text(
        "time_str,machine,temp,speed,fault_flag\n"
        "2026-03-01 10:00:00,m1,42.5,1200,0\n"
        "2026-03-01 10:01:00,m1,43.0,1210,0\n"
        "2026-03-01 10:02:00,m1,85.2,400,1\n"
    )

    loader = GenericCSVLoader(
        timestamp_col="time_str",
        device_id_col="machine",
        label_col="fault_flag",
    )
    loaded = loader.load(csv_file)

    assert loaded.metadata.row_count == 3
    assert "temp" in loaded.metadata.feature_names
    assert "speed" in loaded.metadata.feature_names
    assert loaded.data[COL_GROUND_TRUTH].tolist() == [0, 0, 1]


def test_nab_loader_with_annotations(tmp_path):
    """Verify NAB loader maps JSON window annotations to point-wise labels."""
    nab_csv = tmp_path / "realAWSCloudwatch.csv"
    nab_csv.write_text(
        "timestamp,value\n"
        "2026-01-01 00:00:00,10.0\n"
        "2026-01-01 00:05:00,12.0\n"
        "2026-01-01 00:10:00,55.0\n"
        "2026-01-01 00:15:00,11.0\n"
    )

    labels_json = tmp_path / "combined_windows.json"
    labels_content = {
        "realAWSCloudwatch.csv": [
            ["2026-01-01 00:08:00", "2026-01-01 00:12:00"]
        ]
    }
    labels_json.write_text(json.dumps(labels_content))

    loader = NABLoader()
    loaded = loader.load(nab_csv, labels_json_path=labels_json)

    assert loaded.metadata.label_availability is True
    # Observation at 00:10:00 falls inside window
    assert loaded.data.loc[2, COL_GROUND_TRUTH] == 1
    assert loaded.data.loc[0, COL_GROUND_TRUTH] == 0


def test_nasa_loader(tmp_path):
    """Verify NASA SMAP/MSL loader handles multi-channel numpy matrices and intervals."""
    npy_file = tmp_path / "E-1.npy"
    data_matrix = np.array([
        [1.0, 10.0, 20.0],
        [1.1, 10.2, 20.1],
        [5.5, 50.0, 80.0],
        [1.2, 10.1, 20.2],
    ])
    np.save(npy_file, data_matrix)

    loader = NASALoader(channel_id="E-1")
    loaded = loader.load(npy_file, anomaly_intervals=[[2, 3]])

    assert loaded.metadata.row_count == 4
    assert len(loaded.metadata.feature_names) == 3
    assert loaded.data.loc[2, COL_GROUND_TRUTH] == 1
    assert loaded.data.loc[0, COL_GROUND_TRUTH] == 0
