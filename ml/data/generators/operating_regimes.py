"""Operating regimes and baseline definitions for virtual IoT sensors."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict
from ml.data.schemas import OperatingRegime


@dataclass
class RegimeProfile:
    """Multipliers and offsets applied under different operational states."""
    name: OperatingRegime
    temperature_offset: float  # Degrees Celsius offset
    vibration_multiplier: float  # Multiplier on baseline vibration
    pressure_offset: float  # Bar or kPa offset
    humidity_offset: float  # Relative humidity percentage offset
    noise_multiplier: float  # Multiplier on sensor Gaussian noise


REGIME_PROFILES: Dict[OperatingRegime, RegimeProfile] = {
    OperatingRegime.IDLE: RegimeProfile(
        name=OperatingRegime.IDLE,
        temperature_offset=-5.0,
        vibration_multiplier=0.2,
        pressure_offset=-2.0,
        humidity_offset=2.0,
        noise_multiplier=0.5,
    ),
    OperatingRegime.NORMAL_LOAD: RegimeProfile(
        name=OperatingRegime.NORMAL_LOAD,
        temperature_offset=0.0,
        vibration_multiplier=1.0,
        pressure_offset=0.0,
        humidity_offset=0.0,
        noise_multiplier=1.0,
    ),
    OperatingRegime.HIGH_STRESS: RegimeProfile(
        name=OperatingRegime.HIGH_STRESS,
        temperature_offset=12.0,
        vibration_multiplier=2.5,
        pressure_offset=5.5,
        humidity_offset=-8.0,
        noise_multiplier=1.8,
    ),
    OperatingRegime.MAINTENANCE: RegimeProfile(
        name=OperatingRegime.MAINTENANCE,
        temperature_offset=-8.0,
        vibration_multiplier=0.05,
        pressure_offset=-4.0,
        humidity_offset=5.0,
        noise_multiplier=0.2,
    ),
}
