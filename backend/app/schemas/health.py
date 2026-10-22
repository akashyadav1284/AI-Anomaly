"""Response and error schemas for API endpoints."""
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


def get_utc_now() -> datetime:
    """Return current UTC timestamp."""
    return datetime.now(timezone.utc)


class HealthResponse(BaseModel):
    """Liveness probe response confirming process execution."""
    status: str = Field(..., description="Service liveness status, e.g. 'ok'")
    app_name: str = Field(..., description="Name of the running application")
    version: str = Field(..., description="Application version")
    environment: str = Field(..., description="Runtime environment")
    timestamp: datetime = Field(default_factory=get_utc_now, description="Current UTC timestamp")


class ComponentReadiness(BaseModel):
    """Readiness status of an individual subsystem or dependency."""
    ready: bool = Field(..., description="Whether the component is ready")
    message: str = Field(..., description="Human-readable status or error description")
    details: Optional[Dict[str, Any]] = Field(default=None, description="Optional extra details")


class ReadinessResponse(BaseModel):
    """Readiness probe evaluating operational dependencies."""
    status: str = Field(..., description="'ready' when operational, 'not_ready' otherwise")
    timestamp: datetime = Field(default_factory=get_utc_now, description="Current UTC timestamp")
    components: Dict[str, ComponentReadiness] = Field(
        ..., description="Map of monitored components and their status"
    )


class ErrorDetail(BaseModel):
    """Structured detail for API errors."""
    code: str = Field(..., description="Machine-readable error code")
    message: str = Field(..., description="Descriptive error explanation")
    field: Optional[str] = Field(default=None, description="Parameter or field causing error if applicable")


class ErrorResponse(BaseModel):
    """Consistent error envelope returned across all failed requests."""
    success: bool = Field(default=False)
    error: ErrorDetail
    timestamp: datetime = Field(default_factory=get_utc_now)
