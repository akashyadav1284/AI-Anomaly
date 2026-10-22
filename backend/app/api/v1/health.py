"""Health and readiness router endpoints verifying process and real MongoDB connectivity."""
from fastapi import APIRouter, status
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.db.client import MongoDBManager
from app.schemas.health import ComponentReadiness, HealthResponse, ReadinessResponse

router = APIRouter(tags=["Health & Monitoring"])


@router.get(
    "/health",
    response_model=HealthResponse,
    status_code=status.HTTP_200_OK,
    summary="Application Liveness Probe",
    description="Returns confirmation that the FastAPI server process is active and running.",
)
async def get_health() -> HealthResponse:
    settings = get_settings()
    return HealthResponse(
        status="ok",
        app_name=settings.APP_NAME,
        version=settings.APP_VERSION,
        environment=settings.APP_ENV,
    )


@router.get(
    "/ready",
    response_model=ReadinessResponse,
    responses={
        200: {"model": ReadinessResponse, "description": "Service is fully ready"},
        503: {"model": ReadinessResponse, "description": "One or more critical dependencies unavailable"},
    },
    summary="Application Readiness Probe",
    description="Evaluates live readiness of FastAPI routers and real MongoDB connection.",
)
async def get_readiness():
    settings = get_settings()
    mongo_ready = await MongoDBManager.is_connected()

    components = {
        "api_server": ComponentReadiness(
            ready=True,
            message="FastAPI application router and middleware active.",
        ),
        "database": ComponentReadiness(
            ready=mongo_ready,
            message="MongoDB connection active." if mongo_ready else "MongoDB connection unavailable or unreachable.",
            details={
                "configured_target": settings.DATABASE_NAME,
                "host": settings.MONGODB_URI,
                "status": "connected" if mongo_ready else "disconnected",
            },
        ),
    }

    all_ready = all(comp.ready for comp in components.values())
    overall_status = "ready" if all_ready else "not_ready"
    http_code = status.HTTP_200_OK if all_ready else status.HTTP_503_SERVICE_UNAVAILABLE

    response_content = ReadinessResponse(
        status=overall_status,
        components=components,
    )

    return JSONResponse(
        status_code=http_code,
        content=response_content.model_dump(mode="json"),
    )
