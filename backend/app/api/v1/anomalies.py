"""FastAPI router for anomaly event review, filtering, and status progression."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.db.client import get_db
from app.repositories.mongo_repo import MongoRepository
from app.schemas.api_v1 import (
    AnomalyBulkUpdate,
    AnomalyResponse,
    AnomalyStatusUpdate,
    PaginatedResponse,
    PaginationMeta,
)

router = APIRouter(prefix="/anomalies", tags=["Anomalies"])


@router.get("", response_model=PaginatedResponse)
async def list_anomalies(
    device_id: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    review_status: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    sort_by: str = Query("timestamp"),
    order: str = Query("desc"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=1000),
    limit: Optional[int] = Query(None, ge=1, le=1000),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Retrieve logged anomaly records with filtering and pagination."""
    repo = MongoRepository(db)
    
    # Allow 'status' as an alias for 'review_status'
    effective_status = review_status or status
    if effective_status and effective_status.lower() == "all":
        effective_status = None

    if severity and severity.lower() == "all":
        severity = None

    if device_id and device_id.lower() == "all":
        device_id = None

    effective_limit = limit if limit is not None else page_size
    skip = (page - 1) * effective_limit

    items, total = await repo.list_anomalies(
        device_id=device_id,
        severity=severity,
        review_status=effective_status,
        search=search,
        sort_by=sort_by,
        order=order,
        skip=skip,
        limit=effective_limit,
    )
    total_pages = (total + effective_limit - 1) // effective_limit if total > 0 else 1
    return PaginatedResponse(
        items=items,
        pagination=PaginationMeta(page=page, page_size=effective_limit, total_count=total, total_pages=total_pages),
    )


@router.patch("/bulk-status")
async def bulk_update_anomalies(
    payload: AnomalyBulkUpdate,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Bulk update review status and optional notes for multiple incidents."""
    repo = MongoRepository(db)
    updated_count = await repo.update_anomalies_bulk(
        anomaly_ids=payload.anomaly_ids,
        status=payload.review_status,
        notes=payload.notes,
    )
    return {"status": "success", "updated_count": updated_count}


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
    """Update review status of an incident (e.g., 'acknowledged', 'under_review', 'resolved', 'confirmed', 'false_positive')."""
    repo = MongoRepository(db)
    updated = await repo.update_anomaly_status(
        anomaly_id=anomaly_id,
        status=payload.review_status,
        notes=payload.notes,
    )
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Anomaly '{anomaly_id}' not found.")
    return updated
