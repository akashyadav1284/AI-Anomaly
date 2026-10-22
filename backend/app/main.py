"""FastAPI application factory, lifespan management, and centralized middleware."""
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.v1 import api_v1_router
from app.core.config import get_settings
from app.core.logging import setup_logging
from app.db.client import MongoDBManager
from app.db.indexes import initialize_indexes
from app.schemas.health import ErrorDetail, ErrorResponse


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context managing MongoDB connection initialization and graceful teardown."""
    settings = get_settings()
    logger = setup_logging(settings.LOG_LEVEL)
    logger.info("Initializing %s in %s mode", settings.APP_NAME, settings.APP_ENV)

    # 1. Connect to MongoDB
    await MongoDBManager.connect_to_database()

    # 2. Idempotently initialize collection indexes if connected
    if await MongoDBManager.is_connected():
        await initialize_indexes(MongoDBManager.get_database())

    yield

    # Teardown
    await MongoDBManager.close_database_connection()
    logger.info("Application shutdown completed.")


def create_application() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description="Software-only AI-based IoT sensor anomaly detection service and ML platform.",
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    from app.core.middleware import SecurityHeadersMiddleware, RateLimitMiddleware
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(RateLimitMiddleware, max_requests=200, window_seconds=60)

    app.include_router(api_v1_router, prefix=settings.API_V1_PREFIX)

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        error_resp = ErrorResponse(
            error=ErrorDetail(
                code=f"HTTP_{exc.status_code}",
                message=str(exc.detail),
            )
        )
        return JSONResponse(
            status_code=exc.status_code,
            content=error_resp.model_dump(mode="json"),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        error_resp = ErrorResponse(
            error=ErrorDetail(
                code="VALIDATION_ERROR",
                message="Invalid request payload or parameters.",
                field=str(exc.errors()[0]["loc"]) if exc.errors() else None,
            )
        )
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=error_resp.model_dump(mode="json"),
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        logger = setup_logging()
        logger.error("Unhandled server exception: %s", exc, exc_info=True)
        error_resp = ErrorResponse(
            error=ErrorDetail(
                code="INTERNAL_SERVER_ERROR",
                message="An unexpected server error occurred.",
            )
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=error_resp.model_dump(mode="json"),
        )

    return app


app = create_application()
