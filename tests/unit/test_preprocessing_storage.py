"""Unit tests for validation, cleaning, features, splitting, and storage."""
import pytest
import numpy as np
import pandas as pd
from ml.data.validation.schema_validation import DatasetSchemaValidator
from ml.data.validation.quality_report import QualityReporter
from ml.data.validation.leakage_checks import check_temporal_leakage, check_device_leakage, check_target_leakage_in_features
from ml.data.preprocessing.cleaning import DataCleaner
from ml.data.preprocessing.features import TimeSeriesFeatureEngineer
from ml.data.preprocessing.splitting import TimeSeriesSplitter
from ml.data.storage.dataset_writer import DatasetWriter


def test_schema_validator_catches_infinite_and_duplicates():
    df = pd.DataFrame({
        "timestamp": pd.date_range("2026-01-01", periods=5, freq="1min", tz="UTC"),
        "device_id": ["dev1"] * 5,
        "dataset_id": ["ds1"] * 5,
        "temperature": [20.0, np.inf, 22.0, 23.0, 24.0],
        "ground_truth_is_anomaly": [0, 0, 0, 0, 0],
    })

    validator = DatasetSchemaValidator()
    res = validator.validate(df)

    assert not res.is_valid
    assert any(e.check_name == "infinite_values" for e in res.errors)


def test_causal_feature_engineering_no_leakage():
    df = pd.DataFrame({
        "timestamp": pd.date_range("2026-01-01", periods=6, freq="1min", tz="UTC"),
        "device_id": ["dev1"] * 6,
        "dataset_id": ["ds1"] * 6,
        "temp": [10.0, 20.0, 30.0, 40.0, 50.0, 60.0],
    })

    fe = TimeSeriesFeatureEngineer(rolling_windows=[2], lag_steps=[1])
    fe_df = fe.transform(df)

    assert "temp_lag_1" in fe_df.columns
    assert "temp_roll_mean_2" in fe_df.columns
    # Lag 1 at index 1 should equal value at index 0 (10.0)
    assert fe_df.loc[1, "temp_lag_1"] == 10.0
    # Rolling mean at index 2 (window 2) should be mean(20, 30) = 25.0
    assert fe_df.loc[2, "temp_roll_mean_2"] == 25.0


def test_chronological_splitting():
    df = pd.DataFrame({
        "timestamp": pd.date_range("2026-01-01", periods=10, freq="1h", tz="UTC"),
        "device_id": ["dev1"] * 10,
        "dataset_id": ["ds1"] * 10,
        "vibe": np.arange(10, dtype=float),
    })

    splits = TimeSeriesSplitter.chronological_split(df, train_ratio=0.6, val_ratio=0.2, test_ratio=0.2)
    assert len(splits.train) == 6
    assert len(splits.val) == 2
    assert len(splits.test) == 2
    assert splits.train["timestamp"].max() < splits.val["timestamp"].min()
    assert splits.val["timestamp"].max() < splits.test["timestamp"].min()


def test_dataset_writer_roundtrip(tmp_path):
    df = pd.DataFrame({
        "timestamp": pd.date_range("2026-01-01", periods=5, freq="1min", tz="UTC"),
        "device_id": ["dev1"] * 5,
        "dataset_id": ["ds1"] * 5,
        "sensor_val": [1.1, 2.2, 3.3, 4.4, 5.5],
    })

    csv_path = tmp_path / "test_out.csv"
    pq_path = tmp_path / "test_out.parquet"

    DatasetWriter.save(df, csv_path)
    DatasetWriter.save(df, pq_path)

    assert csv_path.exists()
    assert csv_path.with_name("test_out.metadata.json").exists()
    assert pq_path.exists()

    df_read_csv = pd.read_csv(csv_path)
    assert len(df_read_csv) == 5

    df_read_pq = pd.read_parquet(pq_path)
    assert len(df_read_pq) == 5
