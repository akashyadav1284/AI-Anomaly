"""Comprehensive Pydantic v2 schemas for all Phase 4 backend endpoints."""
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator


def get_utc_now() -> datetime:
    return datetime.now(timezone.utc)


# ==========================================
# Generic & Pagination Schemas
# ==========================================
class PaginationMeta(BaseModel):
    page: int
    page_size: int
    total_count: int
    total_pages: int


class PaginatedResponse(BaseModel):
    items: List[Any]
    pagination: PaginationMeta


# ==========================================
# Dataset Schemas
# ==========================================
class DatasetImportRequest(BaseModel):
    dataset_name: str
    source_type: str = Field(..., description="'synthetic', 'nab', 'nasa', or 'generic'")
    server_file_path: Optional[str] = Field(None, description="Safe relative path inside uploads or data dir")
    description: Optional[str] = None
    parameters: Dict[str, Any] = Field(default_factory=dict)


class SyntheticDatasetGenerateRequest(BaseModel):
    dataset_name: str = "Synthetic_IoT_Lab"
    description: Optional[str] = "Physics-based multivariate industrial telemetry"
    device_count: int = Field(default=2, ge=1, le=10)
    samples_per_device: int = Field(default=1000, ge=100, le=10000)
    sampling_freq: str = "1min"
    inject_anomalies: bool = True
    anomaly_rate: float = Field(default=0.03, ge=0.0, le=0.5)
    random_seed: int = 42


class DatasetPreprocessingRequest(BaseModel):
    dataset_id: str
    handle_missing: str = Field(default="forward_fill", description="'drop', 'forward_fill', 'mean'")
    drop_duplicates: bool = True
    normalize_features: bool = False
    train_split_ratio: float = Field(default=0.7, ge=0.5, le=0.9)
    val_split_ratio: float = Field(default=0.15, ge=0.05, le=0.3)


class DatasetResponse(BaseModel):
    dataset_id: str
    name: str
    source: str = "physical"
    description: Optional[str] = None
    row_count: int = 0
    column_count: int = 0
    feature_names: List[str] = Field(default_factory=list)
    devices: List[str] = Field(default_factory=list)
    timestamp_start: Optional[str] = None
    timestamp_end: Optional[str] = None
    label_availability: bool = False
    created_at: datetime = Field(default_factory=get_utc_now)
    audited_at: Optional[datetime] = None
    quality_summary: Optional[Dict[str, Any]] = None
    storage_path: Optional[str] = None


# ==========================================
# Sensor & Reading Schemas
# ==========================================
class SensorSummary(BaseModel):
    device_id: str
    dataset_id: str
    first_seen: datetime
    last_seen: datetime
    total_readings: int
    active_features: List[str]


class SensorReadingResponse(BaseModel):
    reading_id: str
    device_id: str
    dataset_id: str
    timestamp: datetime
    features: Dict[str, float]


# ==========================================
# Prediction Schemas
# ==========================================
class PredictionRequest(BaseModel):
    device_id: str = Field(..., description="Device or sensor node identifier")
    timestamp: Optional[datetime] = Field(default_factory=get_utc_now)
    features: Dict[str, float] = Field(..., description="Map of feature names to numerical values")
    model_name: str = Field(default="isolation_forest", description="Registered model name")
    model_version: Optional[str] = Field(default="latest", description="Version or 'latest'")

    @field_validator("features")
    @classmethod
    def validate_features(cls, v: Dict[str, float]) -> Dict[str, float]:
        if not v:
            raise ValueError("Features map cannot be empty.")
        for k, val in v.items():
            if val is None or not isinstance(val, (int, float)):
                raise ValueError(f"Feature '{k}' must be a valid number.")
        return v


class PredictionResponse(BaseModel):
    prediction_id: str
    device_id: str
    timestamp: datetime
    model_name: str
    model_version: str
    raw_score: float
    normalized_anomaly_score: float
    decision_threshold: float
    is_anomaly: bool
    explanation: Optional[str] = None
    top_contributing_features: Optional[List[Dict[str, Any]]] = None
    persisted: bool = False


# ==========================================
# Anomaly Schemas
# ==========================================
class AnomalyResponse(BaseModel):
    anomaly_id: str
    device_id: str
    timestamp: datetime
    model_name: str
    model_version: str
    normalized_score: float
    threshold: float
    severity: str
    review_status: str
    affected_features: List[str]
    explanation: Optional[str] = None
    acknowledged_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None


class AnomalyStatusUpdate(BaseModel):
    review_status: str = Field(..., description="'pending', 'under_review', 'confirmed', 'acknowledged', 'resolved', 'false_positive'")
    notes: Optional[str] = None


class AnomalyBulkUpdate(BaseModel):
    anomaly_ids: List[str]
    review_status: str = Field(..., description="'pending', 'under_review', 'confirmed', 'acknowledged', 'resolved', 'false_positive'")
    notes: Optional[str] = None


# ==========================================
# Model & Training Schemas
# ==========================================
class ModelTrainingRequest(BaseModel):
    dataset_id: str
    model_name: str = "isolation_forest"
    model_params: Dict[str, Any] = Field(default_factory=dict)
    scaler_type: str = "standard"
    enable_time_features: bool = False
    contamination: float = 0.03
    threshold_method: str = "contamination"
    seed: int = 42


class ModelResponse(BaseModel):
    model_id: str
    model_name: str
    model_version: str = "1.0.0"
    algorithm: str = "ML Anomaly Detector"
    feature_names: List[str] = Field(default_factory=lambda: ["temperature", "humidity", "accel_x", "accel_y", "accel_z", "vibration_rms"])
    threshold: float = 0.50
    threshold_method: str = "contamination"
    status: str = "ready"
    created_at: datetime = Field(default_factory=get_utc_now)
    evaluation_metrics: Optional[Dict[str, Any]] = None


class JobStatusResponse(BaseModel):
    job_id: str
    job_type: str
    status: str  # 'queued', 'running', 'completed', 'failed'
    progress_percentage: float = 0.0
    created_at: datetime
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    result_data: Optional[Dict[str, Any]] = None


# ==========================================
# Experiment Schemas
# ==========================================
class ExperimentCreateRequest(BaseModel):
    experiment_name: str
    dataset_id: str
    model_name: str
    model_params: Dict[str, Any] = Field(default_factory=dict)
    scaler_type: str = "standard"
    split_strategy: str = "chronological"
    seed: int = 42


class ExperimentResponse(BaseModel):
    experiment_id: str
    name: str
    dataset_id: str
    model_name: str
    status: str
    created_at: datetime
    metrics: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None


# ==========================================
# Simulator Schemas (Phase 5)
# ==========================================
class AnomalyInjectionConfig(BaseModel):
    anomaly_type: str = Field("spike", description="Type: spike, drift, noise, freeze, square_wave, regime_shift")
    target_channels: List[str] = Field(default_factory=lambda: ["temperature"], description="Channels to contaminate")
    magnitude: float = Field(3.0, description="Anomaly intensity multiplier or offset")
    duration_steps: int = Field(5, ge=1, description="Number of steps the anomaly persists")
    start_step: int = Field(10, ge=0, description="Step offset when injection begins")


class SimulatorStartRequest(BaseModel):
    devices: List[str] = Field(default_factory=lambda: ["sensor-01", "sensor-02"], description="Virtual device IDs")
    sampling_rate_hz: float = Field(2.0, ge=0.1, le=50.0, description="Readings generated per second")
    playback_speed: float = Field(1.0, ge=0.1, le=10.0, description="Speed multiplier")
    model_name: str = Field("isolation_forest", description="Trained model to use for inference")
    random_seed: int = Field(42, description="RNG seed for deterministic telemetry generation")
    persist_to_db: bool = Field(True, description="Whether readings and anomalies persist into MongoDB")
    dataset_replay_name: Optional[str] = Field(None, description="Optional dataset to replay instead of synthetic stream")
    anomaly_injections: List[AnomalyInjectionConfig] = Field(default_factory=list, description="Scheduled anomaly injections")


class SimulatorMetrics(BaseModel):
    generated_count: int = 0
    inferred_count: int = 0
    anomalies_detected: int = 0
    persisted_count: int = 0
    dropped_messages: int = 0
    avg_latency_ms: float = 0.0
    throughput_rps: float = 0.0


class SimulatorStatusResponse(BaseModel):
    simulation_id: Optional[str] = None
    status: str = Field(..., description="stopped, running, paused")
    devices: List[str] = Field(default_factory=list)
    model_name: Optional[str] = None
    sampling_rate_hz: float = 1.0
    playback_speed: float = 1.0
    uptime_seconds: float = 0.0
    connected_ws_clients: int = 0
    metrics: SimulatorMetrics = Field(default_factory=SimulatorMetrics)
    created_at: Optional[datetime] = None


class SimulatorControlResponse(BaseModel):
    status: str
    message: str
    simulation_id: Optional[str] = None
    playback_speed: Optional[float] = None


# ==========================================
# Physical IoT Device Schemas (Phase 3 & 4)
# ==========================================
class PhysicalSensorChannels(BaseModel):
    """Raw and processed sensor measurements from physical ESP32 node."""
    temperature: float = Field(..., ge=-40.0, le=125.0, description="Temperature from DHT22 in Celsius")
    humidity: float = Field(..., ge=0.0, le=100.0, description="Relative humidity from DHT22 in %")
    accel_x: float = Field(..., ge=-100.0, le=100.0, description="MPU6050 X-axis acceleration in m/s^2")
    accel_y: float = Field(..., ge=-100.0, le=100.0, description="MPU6050 Y-axis acceleration in m/s^2")
    accel_z: float = Field(..., ge=-100.0, le=100.0, description="MPU6050 Z-axis acceleration in m/s^2")
    gyro_x: Optional[float] = Field(0.0, description="MPU6050 X-axis angular velocity in rad/s")
    gyro_y: Optional[float] = Field(0.0, description="MPU6050 Y-axis angular velocity in rad/s")
    gyro_z: Optional[float] = Field(0.0, description="MPU6050 Z-axis angular velocity in rad/s")
    acceleration_magnitude: Optional[float] = Field(None, description="Vector magnitude sqrt(ax^2+ay^2+az^2)")
    vibration_rms: Optional[float] = Field(None, description="Root Mean Square vibration metric")


class PhysicalThresholdsConfig(BaseModel):
    """Configurable multi-axis operational thresholds for physical anomaly detection."""
    temp_min: Optional[float] = Field(18.0, description="Minimum allowable temperature in °C")
    temp_max: Optional[float] = Field(32.0, description="Maximum allowable temperature in °C")
    hum_min: Optional[float] = Field(25.0, description="Minimum allowable relative humidity in %")
    hum_max: Optional[float] = Field(70.0, description="Maximum allowable relative humidity in %")
    accel_x_max: Optional[float] = Field(2.5, description="Maximum allowable X-axis acceleration magnitude in m/s^2")
    accel_y_max: Optional[float] = Field(2.5, description="Maximum allowable Y-axis acceleration magnitude in m/s^2")
    accel_z_dev_max: Optional[float] = Field(3.0, description="Maximum allowable deviation from 1G standard gravity on Z in m/s^2")
    vibration_max: Optional[float] = Field(0.35, description="Maximum allowable vibration RMS in g")
    gyro_max: Optional[float] = Field(50.0, description="Maximum allowable angular velocity in deg/s or rad/s")


class PhysicalTelemetryPayload(BaseModel):
    """Payload schema transmitted by physical ESP32 nodes."""
    device_id: str = Field(..., min_length=2, max_length=64, description="Unique physical device identifier")
    source: str = Field(default="physical", description="Origin: 'physical' or 'simulated'")
    sequence: Optional[int] = Field(None, ge=0, description="Monotonically increasing sequence number")
    timestamp: Optional[datetime] = Field(default_factory=get_utc_now, description="Reading timestamp in UTC")
    sensors: PhysicalSensorChannels
    model_name: Optional[str] = Field(default="isolation_forest", description="ML model for anomaly inference")
    thresholds: Optional[PhysicalThresholdsConfig] = Field(None, description="Optional custom operational threshold overrides")


class DeviceStatusSummary(BaseModel):
    """Real-time connectivity and health summary for IoT devices."""
    device_id: str
    source: str = Field(default="physical", description="'physical' or 'simulated'")
    status: str = Field(..., description="'online', 'standby', 'offline'")
    first_seen: datetime
    last_seen: datetime
    seconds_since_last_seen: float
    total_readings: int
    last_sequence: Optional[int] = None
    last_reading: Optional[Dict[str, float]] = None
    sensor_health: Dict[str, bool] = Field(default_factory=dict)


