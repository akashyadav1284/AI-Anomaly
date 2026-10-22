"""Configurable synthetic IoT sensor telemetry generator."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict, List, Optional
import numpy as np
import pandas as pd

from ml.data.schemas import (
    AnomalyType,
    COL_ANOMALY_TYPE,
    COL_DATASET_ID,
    COL_DEVICE_ID,
    COL_EVENT_ID,
    COL_GROUND_TRUTH,
    COL_TIMESTAMP,
    OperatingRegime,
)
from ml.data.generators.operating_regimes import REGIME_PROFILES
from ml.data.generators.anomaly_injector import AnomalyInjector, AnomalyEventConfig


@dataclass
class ChannelSpec:
    """Specification for a simulated physical sensor channel."""
    name: str
    baseline: float
    diurnal_amplitude: float
    noise_std: float
    unit: str
    min_val: Optional[float] = None
    max_val: Optional[float] = None


DEFAULT_CHANNELS: List[ChannelSpec] = [
    ChannelSpec("temperature", baseline=45.0, diurnal_amplitude=8.0, noise_std=0.5, unit="Celsius", min_val=-20.0, max_val=120.0),
    ChannelSpec("humidity", baseline=55.0, diurnal_amplitude=-15.0, noise_std=1.2, unit="Percent", min_val=0.0, max_val=100.0),
    ChannelSpec("pressure", baseline=101.3, diurnal_amplitude=1.5, noise_std=0.2, unit="kPa", min_val=50.0, max_val=200.0),
    ChannelSpec("vibration", baseline=1.2, diurnal_amplitude=0.3, noise_std=0.1, unit="mm/s", min_val=0.0, max_val=25.0),
    ChannelSpec("current", baseline=12.5, diurnal_amplitude=2.0, noise_std=0.3, unit="Amperes", min_val=0.0, max_val=60.0),
]


class IoTSensorGenerator:
    """Generates synthetic multivariate telemetry for multiple virtual IoT devices with physics-based patterns."""

    def __init__(
        self,
        channels: Optional[List[ChannelSpec]] = None,
        random_state: int = 42,
        dataset_id: str = "synthetic_iot_v1",
    ):
        self.channels = channels or DEFAULT_CHANNELS
        self.random_state = random_state
        self.dataset_id = dataset_id
        self.rng = np.random.default_rng(random_state)
        self.injector = AnomalyInjector(random_state=random_state)

    def generate(
        self,
        n_rows: int = 5000,
        devices: Optional[List[str]] = None,
        start_time: Optional[datetime] = None,
        freq: str = "1min",
        inject_anomalies: bool = True,
        anomaly_rate: float = 0.03,  # Approximate fraction of anomalous timestamps
    ) -> pd.DataFrame:
        """Generate multivariate time-series data for specified devices.
        
        Args:
            n_rows: Total observations per device.
            devices: Device identifier strings. Defaults to ['sensor_node_01', 'sensor_node_02'].
            start_time: UTC start timestamp. Defaults to 2026-01-01 00:00:00 UTC.
            freq: Pandas frequency string.
            inject_anomalies: Whether to inject controlled anomaly events.
            anomaly_rate: Proportion of sequence to affect with anomalies.
        """
        devices = devices or ["sensor_node_01", "sensor_node_02"]
        start_time = start_time or datetime(2026, 1, 1, 0, 0, tzinfo=timezone.utc)

        all_device_dfs: List[pd.DataFrame] = []

        for dev_idx, device_id in enumerate(devices):
            dev_seed = self.random_state + (dev_idx * 1000)
            dev_rng = np.random.default_rng(dev_seed)

            # Generate UTC datetime index
            timestamps = pd.date_range(start=start_time, periods=n_rows, freq=freq, tz=timezone.utc)
            t_seconds = (timestamps - timestamps[0]).total_seconds().values
            hours = timestamps.hour.values + (timestamps.minute.values / 60.0)

            # Assign operating regimes based on 24-hour business and load cycles
            regimes = np.full(n_rows, OperatingRegime.NORMAL_LOAD, dtype=object)
            regimes[(hours >= 22) | (hours < 6)] = OperatingRegime.IDLE
            regimes[(hours >= 13) & (hours < 16)] = OperatingRegime.HIGH_STRESS

            # Device-specific baseline variation (+/- 5% device offsets)
            device_dev_factor = 1.0 + (dev_rng.normal(0, 0.04))

            data_dict: Dict[str, np.ndarray] = {
                COL_TIMESTAMP: timestamps,
                COL_DEVICE_ID: np.full(n_rows, device_id, dtype=object),
                COL_DATASET_ID: np.full(n_rows, self.dataset_id, dtype=object),
            }

            # Generate each channel signal
            for ch in self.channels:
                base = ch.baseline * device_dev_factor
                # Diurnal periodic wave (24 hour period = 86400s)
                diurnal = ch.diurnal_amplitude * np.sin(2 * np.pi * t_seconds / 86400.0)
                # Second higher frequency harmonic (8 hour machine cycle)
                harmonic = (ch.diurnal_amplitude * 0.25) * np.cos(2 * np.pi * t_seconds / 28800.0)

                # Regime offsets
                regime_offsets = np.zeros(n_rows)
                regime_noise_mult = np.ones(n_rows)

                for r_name, profile in REGIME_PROFILES.items():
                    mask = (regimes == r_name)
                    if ch.name == "temperature":
                        regime_offsets[mask] = profile.temperature_offset
                    elif ch.name == "vibration":
                        regime_offsets[mask] = (profile.vibration_multiplier - 1.0) * base
                    elif ch.name == "pressure":
                        regime_offsets[mask] = profile.pressure_offset
                    elif ch.name == "humidity":
                        regime_offsets[mask] = profile.humidity_offset
                    regime_noise_mult[mask] = profile.noise_multiplier

                # Normal Gaussian sensor noise
                noise = dev_rng.normal(0, ch.noise_std, size=n_rows) * regime_noise_mult

                signal = base + diurnal + harmonic + regime_offsets + noise

                # Cross-sensor physical correlation: vibration and temperature correlate under load
                if ch.name == "temperature":
                    temp_cache = signal
                elif ch.name == "vibration" and "temperature" in [c.name for c in self.channels]:
                    # Machine heat induces slight thermal expansion and vibration
                    signal += 0.02 * (temp_cache - np.mean(temp_cache))

                # Physical range boundaries
                if ch.min_val is not None:
                    signal = np.maximum(signal, ch.min_val)
                if ch.max_val is not None:
                    signal = np.minimum(signal, ch.max_val)

                data_dict[ch.name] = signal

            df_device = pd.DataFrame(data_dict)
            df_device[COL_GROUND_TRUTH] = 0
            df_device[COL_ANOMALY_TYPE] = AnomalyType.NONE.value
            df_device[COL_EVENT_ID] = None

            # Controlled anomaly injection
            if inject_anomalies:
                anomaly_configs = self._create_anomaly_schedule(
                    n_rows=n_rows,
                    device_id=device_id,
                    target_rate=anomaly_rate,
                    rng=dev_rng,
                )
                df_device = self.injector.inject_anomalies(df_device, anomaly_configs)

            all_device_dfs.append(df_device)

        result_df = pd.concat(all_device_dfs, ignore_index=True)
        # Ensure proper sorting by timestamp and device_id
        result_df = result_df.sort_values(by=[COL_TIMESTAMP, COL_DEVICE_ID]).reset_index(drop=True)
        return result_df

    def _create_anomaly_schedule(
        self,
        n_rows: int,
        device_id: str,
        target_rate: float,
        rng: np.random.Generator,
    ) -> List[AnomalyEventConfig]:
        """Generate non-overlapping schedule of varied anomaly events."""
        configs: List[AnomalyEventConfig] = []
        anomaly_types = [
            AnomalyType.POINT_SPIKE,
            AnomalyType.CONTEXTUAL,
            AnomalyType.COLLECTIVE,
            AnomalyType.GRADUAL_DRIFT,
            AnomalyType.STUCK_SENSOR,
            AnomalyType.NOISE_BURST,
            AnomalyType.MISSING_CORRUPTED,
        ]

        channel_names = [ch.name for ch in self.channels]
        total_target_anomalous = int(n_rows * target_rate)
        if total_target_anomalous <= 0:
            return configs

        # Space events across sequence
        step = max(int(n_rows / (len(anomaly_types) + 2)), 30)
        curr_idx = step // 2
        event_num = 1

        for atype in anomaly_types:
            if curr_idx + 25 >= n_rows:
                break

            if atype == AnomalyType.POINT_SPIKE:
                duration = 1
                severity = 4.5
            elif atype == AnomalyType.COLLECTIVE:
                duration = min(40, n_rows - curr_idx)
                severity = 3.0
            elif atype == AnomalyType.GRADUAL_DRIFT:
                duration = min(60, n_rows - curr_idx)
                severity = 4.0
            elif atype == AnomalyType.STUCK_SENSOR:
                duration = min(30, n_rows - curr_idx)
                severity = 0.0
            else:
                duration = min(20, n_rows - curr_idx)
                severity = 3.5

            # Select 1 or 2 affected channels
            n_ch = 1 if atype in [AnomalyType.STUCK_SENSOR, AnomalyType.POINT_SPIKE] else 2
            affected = list(rng.choice(channel_names, size=n_ch, replace=False))

            configs.append(
                AnomalyEventConfig(
                    event_id=f"EVT_{device_id}_{event_num:03d}",
                    anomaly_type=atype,
                    start_idx=curr_idx,
                    duration=duration,
                    affected_channels=affected,
                    severity=severity,
                    device_id=device_id,
                )
            )
            event_num += 1
            curr_idx += duration + step

        return configs
