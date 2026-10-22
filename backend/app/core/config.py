"""Application settings and configuration."""
from functools import lru_cache
from typing import List, Union
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    APP_NAME: str = "AI-Based IoT Sensor Anomaly Detection API"
    APP_VERSION: str = "0.4.0"
    APP_ENV: str = Field(default="development", description="Environment: development, staging, production")
    LOG_LEVEL: str = Field(default="INFO", description="Logging level")

    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    API_V1_PREFIX: str = "/api/v1"

    # CORS configuration
    CORS_ORIGINS: Union[List[str], str] = ["*"]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            if v.strip() == "*":
                return ["*"]
            raw_items = [i.strip() for i in v.split(",") if i.strip()]
            normalized = []
            for item in raw_items:
                if item == "*":
                    normalized.append("*")
                    continue
                # Normalize origin by ensuring scheme and stripping path
                if not item.startswith("http://") and not item.startswith("https://"):
                    normalized.append(f"https://{item}")
                    normalized.append(f"http://{item}")
                else:
                    normalized.append(item.rstrip("/"))
            return normalized
        elif isinstance(v, list):
            return v
        return [str(v)]

    # Database configuration
    MONGODB_URI: str = "mongodb://127.0.0.1:27017"
    DATABASE_NAME: str = "iot_anomaly_detection"
    MONGODB_MAX_POOL_SIZE: int = 50
    MONGODB_MIN_POOL_SIZE: int = 10
    MONGODB_TIMEOUT_MS: int = 4000

    # Storage paths
    ARTIFACTS_DIR: str = "artifacts/models"
    UPLOAD_DIR: str = "uploads/datasets"

    # Security & API Keys
    API_KEY: str = "iot-secret-api-key-2026"
    JWT_SECRET_KEY: str = "iot-jwt-super-secret-key-change-in-prod"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24

    # Upload constraints
    MAX_UPLOAD_SIZE_BYTES: int = 15 * 1024 * 1024  # 15 MB limit


@lru_cache()
def get_settings() -> Settings:
    """Return cached application settings."""
    return Settings()
