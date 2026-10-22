"""FastAPI router for anomaly event review, filtering, and status progression."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.db.client import get_db
from app.repositories.mongo_repo import MongoRepository
from app.schemas.api_v1 import AnomalyResponse, AnomalyStatusUpdate, PaginatedResponse, PaginationMeta

router = APIRouter(prefix="/anomalies", tags=["Anomalies"])


@router.get("", response_model=PaginatedResponse)
async def list_anomalies(
    device_id: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    review_status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Retrieve logged anomaly records with filtering and pagination."""
    repo = MongoRepository(db)
    skip = (page - 1) * page_size
    items, total = await repo.list_anomalies(
        device_id=device_id,
        severity=severity,
        review_status=review_status,
        skip=skip,
        limit=page_size,
    )
    total_pages = (total + page_size - 1) // page_size if total > 0 else 1
    return PaginatedResponse(
        items=items,
        pagination=PaginationMeta(page=page, page_size=page_size, total_count=total, total_pages=total_pages),
    )


@router.get("/{anomaly_id}", response_model=AnomalyResponse)
async def get_anomaly(anomaly_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    repo = MongoRepository(db)
    anom = await repo.get_anomaly(anomaly_id)
    if not anom:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Anomaly '{anomaly_id}' not found.")
    return anom


@router.patch("/{anomaly_id}/status", response_model=AnomalyResponse)
async def update_anomaly_status(
    anomaly_id: str,
    payload: AnomalyStatusUpdate,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Update review status of an incident (e.g., 'acknowledged', 'resolved', 'false_positive')."""
    repo = MongoRepository(db)
    updated = await repo.update_anomaly_status(
        anomaly_id=anomaly_id,
        status=payload.review_status,
        notes=payload.notes,
    )
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Anomaly '{anomaly_id}' not found.")
    return updated
