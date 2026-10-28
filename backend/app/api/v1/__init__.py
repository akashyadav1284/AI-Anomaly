"""v1 API router configuration aggregating all endpoint routers."""
from fastapi import APIRouter
from app.api.v1.health import router as health_router
from app.api.v1.datasets import router as datasets_router
from app.api.v1.sensors import router as sensors_router
from app.api.v1.predictions import router as predictions_router
from app.api.v1.anomalies import router as anomalies_router
from app.api.v1.models import router as models_router
from app.api.v1.experiments import router as experiments_router
from app.api.v1.simulator import router as simulator_router
from app.api.v1.system import router as system_router

api_v1_router = APIRouter()
api_v1_router.include_router(health_router)
api_v1_router.include_router(datasets_router)
api_v1_router.include_router(sensors_router)
api_v1_router.include_router(predictions_router)
api_v1_router.include_router(anomalies_router)
api_v1_router.include_router(models_router)
api_v1_router.include_router(experiments_router)
api_v1_router.include_router(simulator_router)
api_v1_router.include_router(system_router)
