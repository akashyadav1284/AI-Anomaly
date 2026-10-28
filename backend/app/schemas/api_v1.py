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


class DatasetResponse(BaseModel):
    dataset_id: str
    name: str
    source: str
    description: Optional[str] = None
    row_count: int
    column_count: int
    feature_names: List[str]
    devices: List[str]
    timestamp_start: Optional[str] = None
    timestamp_end: Optional[str] = None
    label_availability: bool = False
    created_at: datetime
    quality_summary: Optional[Dict[str, Any]] = None


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
    model_version: str
    algorithm: str
    feature_names: List[str]
    threshold: float
    threshold_method: str
    status: str
    created_at: datetime
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

