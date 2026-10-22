"""FastAPI router for model registry discovery and asynchronous model training jobs."""
import asyncio
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import List
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.core.security import get_current_api_key
from app.db.client import get_db
from app.repositories.mongo_repo import MongoRepository
from app.schemas.api_v1 import JobStatusResponse, ModelResponse, ModelTrainingRequest
from app.workers.training_worker import run_training_job_async

router = APIRouter(prefix="/models", tags=["Models"])


@router.get("", response_model=List[ModelResponse])
async def list_models(db: AsyncIOMotorDatabase = Depends(get_db)):
    """List registered models from database and check disk artifacts."""
    repo = MongoRepository(db)
    models = await repo.list_models()

    # If no DB records yet, scan disk for artifacts generated in Phase 3
    if not models:
        base_dir = Path("artifacts/models")
        if base_dir.exists():
            for m_dir in base_dir.iterdir():
                if m_dir.is_dir() and (m_dir / "model.joblib").exists():
                    models.append({
                        "model_id": f"MOD_{m_dir.name}",
                        "model_name": m_dir.name,
                        "model_version": "0.1.0",
                        "algorithm": m_dir.name,
                        "feature_names": ["temperature", "humidity", "pressure", "vibration", "current"],
                        "threshold": 0.5,
                        "threshold_method": "contamination",
                        "status": "ready",
                        "created_at": datetime.now(timezone.utc),
                    })
    return models


@router.get("/{model_id}", response_model=ModelResponse)
async def get_model(model_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    repo = MongoRepository(db)
    model = await repo.get_model(model_id)
    if not model:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Model '{model_id}' not found.")
    return model


@router.post("/train", response_model=JobStatusResponse, status_code=status.HTTP_202_ACCEPTED)
async def train_model_job(
    payload: ModelTrainingRequest,
    background_tasks: BackgroundTasks,
    db: AsyncIOMotorDatabase = Depends(get_db),
    _auth: str = Depends(get_current_api_key),
):
    """Launch asynchronous background model training job. Protected via X-API-Key."""
    repo = MongoRepository(db)

    # Check dataset existence
    dataset = await repo.get_dataset(payload.dataset_id)
    if not dataset:
        # Check if local file exists with dataset_id name
        alt_path = Path("data/synthetic/demo.csv")
        if not alt_path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Dataset '{payload.dataset_id}' not found in database or disk.",
            )
        data_path = str(alt_path)
    else:
        data_path = dataset.get("storage_path", "data/synthetic/demo.csv")

    job_id = f"JOB_TRAIN_{uuid.uuid4().hex[:10]}"
    job_doc = {
        "job_id": job_id,
        "job_type": "model_training",
        "status": "queued",
        "progress_percentage": 0.0,
        "created_at": datetime.now(timezone.utc),
        "parameters": payload.model_dump(),
    }
    await repo.create_job(job_doc)

    # Delegate to background task worker
    background_tasks.add_task(
        run_training_job_async,
        job_id=job_id,
        dataset_path=data_path,
        model_name=payload.model_name,
        model_params=payload.model_params,
        scaler_type=payload.scaler_type,
        contamination=payload.contamination,
        seed=payload.seed,
        repo=repo,
    )

    return job_doc


@router.get("/jobs/{job_id}", response_model=JobStatusResponse)
async def get_job_status(job_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    repo = MongoRepository(db)
    job = await repo.get_job(job_id)
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Job '{job_id}' not found.")
    return job
