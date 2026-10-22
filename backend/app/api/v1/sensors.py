"""FastAPI router for sensor registry and historical readings."""
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.db.client import get_db
from app.repositories.mongo_repo import MongoRepository
from app.schemas.api_v1 import PaginatedResponse, PaginationMeta, SensorReadingResponse, SensorSummary

router = APIRouter(prefix="/sensors", tags=["Sensors"])


@router.get("", response_model=List[SensorSummary])
async def list_sensors(db: AsyncIOMotorDatabase = Depends(get_db)):
    """List all registered virtual IoT sensor devices and reading counts."""
    repo = MongoRepository(db)
    sensors = await repo.list_sensors()
    # Format into SensorSummary
    result = []
    for s in sensors:
        result.append(
            SensorSummary(
                device_id=s["device_id"],
                dataset_id=s.get("dataset_id", "live"),
                first_seen=s.get("first_seen", datetime.utcnow()),
                last_seen=s.get("last_seen", datetime.utcnow()),
                total_readings=s.get("total_readings", 0),
                active_features=[],
            )
        )
    return result


@router.get("/{device_id}/readings", response_model=PaginatedResponse)
async def get_device_readings(
    device_id: str,
    start_time: Optional[datetime] = Query(None),
    end_time: Optional[datetime] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Retrieve historical sensor readings for a specific device. Excludes ground-truth labels."""
    repo = MongoRepository(db)
    skip = (page - 1) * page_size
    items, total = await repo.get_device_readings(
        device_id=device_id,
        start_time=start_time,
        end_time=end_time,
        skip=skip,
        limit=page_size,
    )
    total_pages = (total + page_size - 1) // page_size if total > 0 else 1
    return PaginatedResponse(
        items=items,
        pagination=PaginationMeta(page=page, page_size=page_size, total_count=total, total_pages=total_pages),
    )
