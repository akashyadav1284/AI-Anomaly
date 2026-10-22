"""Unit tests for synthetic IoT sensor generator and anomaly injector."""
import pytest
import pandas as pd
import numpy as np
from ml.data.generators.sensor_generator import IoTSensorGenerator, ChannelSpec
from ml.data.generators.anomaly_injector import AnomalyInjector, AnomalyEventConfig
from ml.data.schemas import AnomalyType, COL_GROUND_TRUTH, COL_ANOMALY_TYPE, COL_EVENT_ID


def test_generator_deterministic_output():
    """Verify identical random seeds produce identical numeric observations."""
    gen1 = IoTSensorGenerator(random_state=42)
    gen2 = IoTSensorGenerator(random_state=42)

    df1 = gen1.generate(n_rows=50, devices=["dev_01"], inject_anomalies=False)
    df2 = gen2.generate(n_rows=50, devices=["dev_01"], inject_anomalies=False)

    pd.testing.assert_frame_equal(df1, df2)


def test_generator_multiple_devices_and_schema():
    """Verify generation across multiple virtual devices with proper schemas."""
    devices = ["sensor_A", "sensor_B", "sensor_C"]
    gen = IoTSensorGenerator(random_state=123)
    df = gen.generate(n_rows=100, devices=devices, inject_anomalies=True)

    assert len(df) == 300
    assert sorted(df["device_id"].unique().tolist()) == sorted(devices)
    assert "temperature" in df.columns
    assert "vibration" in df.columns
    assert COL_GROUND_TRUTH in df.columns
    assert COL_ANOMALY_TYPE in df.columns
    assert COL_EVENT_ID in df.columns


def test_all_anomaly_types_injection():
    """Verify each of the 7 anomaly types can be injected and accurately labeled."""
    injector = AnomalyInjector(random_state=99)
    df = pd.DataFrame({
        "temperature": np.full(100, 25.0),
        "vibration": np.full(100, 1.0),
    })

    configs = [
        AnomalyEventConfig(
            event_id="EVT_SPIKE",
            anomaly_type=AnomalyType.POINT_SPIKE,
            start_idx=10,
            duration=1,
            affected_channels=["temperature"],
            severity=5.0,
        ),
        AnomalyEventConfig(
            event_id="EVT_DRIFT",
            anomaly_type=AnomalyType.GRADUAL_DRIFT,
            start_idx=20,
            duration=10,
            affected_channels=["temperature"],
            severity=3.0,
        ),
        AnomalyEventConfig(
            event_id="EVT_STUCK",
            anomaly_type=AnomalyType.STUCK_SENSOR,
            start_idx=40,
            duration=10,
            affected_channels=["vibration"],
            severity=0.0,
        ),
        AnomalyEventConfig(
            event_id="EVT_NOISE",
            anomaly_type=AnomalyType.NOISE_BURST,
            start_idx=60,
            duration=10,
            affected_channels=["vibration"],
            severity=4.0,
        ),
        AnomalyEventConfig(
            event_id="EVT_MISSING",
            anomaly_type=AnomalyType.MISSING_CORRUPTED,
            start_idx=80,
            duration=5,
            affected_channels=["temperature"],
            parameters={"mode": "nan"},
        ),
    ]

    injected = injector.inject_anomalies(df, configs)

    # Spike at index 10
    assert injected.loc[10, COL_GROUND_TRUTH] == 1
    assert injected.loc[10, COL_ANOMALY_TYPE] == AnomalyType.POINT_SPIKE.value
    assert injected.loc[10, "temperature"] > 25.0

    # Normal row before spike
    assert injected.loc[9, COL_GROUND_TRUTH] == 0
    assert injected.loc[9, COL_ANOMALY_TYPE] == AnomalyType.NONE.value

    # Drift over 20:30
    assert injected.loc[20:29, COL_GROUND_TRUTH].all() == 1
    assert (injected.loc[20:29, COL_ANOMALY_TYPE] == AnomalyType.GRADUAL_DRIFT.value).all()

    # Missing over 80:85
    assert np.isnan(injected.loc[80:84, "temperature"]).all()
