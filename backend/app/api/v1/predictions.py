"""FastAPI router for real-time model inference and anomaly scoring."""
from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.db.client import get_db
from app.repositories.mongo_repo import MongoRepository
from app.schemas.api_v1 import PredictionRequest, PredictionResponse
from app.services.prediction_service import PredictionService

router = APIRouter(prefix="/predictions", tags=["Predictions"])


@router.post("", response_model=PredictionResponse, status_code=status.HTTP_200_OK)
async def create_prediction(payload: PredictionRequest, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Run real model inference against submitted telemetry features.
    
    1. Validates input schema and dimension.
    2. Runs model through fitted preprocessing pipeline.
    3. Scores anomaly likelihood and generates feature attribution explanation.
    4. Persists prediction and flags anomaly in MongoDB.
    """
    repo = MongoRepository(db)
    service = PredictionService(repo)

    try:
        res = await service.predict_single(
            device_id=payload.device_id,
            features=payload.features,
            timestamp=payload.timestamp,
            model_name=payload.model_name,
            model_version=payload.model_version or "latest",
        )
        return res
    except FileNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Inference error: {e}")
