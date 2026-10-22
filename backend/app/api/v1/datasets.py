"""FastAPI router for dataset cataloging, statistics, and imports."""
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase
import pandas as pd
from app.db.client import get_db
from app.repositories.mongo_repo import MongoRepository
from app.schemas.api_v1 import DatasetImportRequest, DatasetResponse, PaginatedResponse, PaginationMeta
from ml.data.loaders.nab_loader import NABLoader
from ml.data.loaders.nasa_loader import NASALoader
from ml.data.loaders.generic_csv_loader import GenericCSVLoader
from ml.data.validation.quality_report import QualityReporter

router = APIRouter(prefix="/datasets", tags=["Datasets"])


@router.get("", response_model=PaginatedResponse)
async def list_datasets(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    repo = MongoRepository(db)
    skip = (page - 1) * page_size
    items, total = await repo.list_datasets(skip=skip, limit=page_size)
    total_pages = (total + page_size - 1) // page_size if total > 0 else 1
    return PaginatedResponse(
        items=items,
        pagination=PaginationMeta(page=page, page_size=page_size, total_count=total, total_pages=total_pages),
    )


@router.get("/{dataset_id}", response_model=DatasetResponse)
async def get_dataset(dataset_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    repo = MongoRepository(db)
    ds = await repo.get_dataset(dataset_id)
    if not ds:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Dataset '{dataset_id}' not found.")
    return ds


@router.get("/{dataset_id}/quality")
async def get_dataset_quality(dataset_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    repo = MongoRepository(db)
    ds = await repo.get_dataset(dataset_id)
    if not ds:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Dataset '{dataset_id}' not found.")
    return ds.get("quality_summary", {})


@router.post("/import", response_model=DatasetResponse, status_code=status.HTTP_201_CREATED)
async def import_dataset(payload: DatasetImportRequest, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Import and validate server-side dataset file or register synthetic dataset."""
    repo = MongoRepository(db)
    ds_id = f"DS_{uuid.uuid4().hex[:8]}"

    # Validate server file path against path traversal
    if payload.server_file_path:
        safe_path = Path(payload.server_file_path).resolve()
        cwd = Path(".").resolve()
        if not str(safe_path).startswith(str(cwd)):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Path traversal not allowed.")
        if not safe_path.exists():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"File not found: {payload.server_file_path}")

        # Ingest using appropriate loader
        if payload.source_type == "nab":
            loader = NABLoader(dataset_id=ds_id)
            loaded = loader.load(safe_path)
        elif payload.source_type == "nasa":
            loader = NASALoader(dataset_id=ds_id)
            loaded = loader.load(safe_path)
        else:
            loader = GenericCSVLoader(timestamp_col="timestamp", dataset_id=ds_id)
            loaded = loader.load(safe_path)

        df = loaded.data
        meta = loaded.metadata
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="server_file_path is required for import.")

    # Quality report
    reporter = QualityReporter()
    q_rep = reporter.generate_report(df)

    doc = {
        "dataset_id": ds_id,
        "name": payload.dataset_name,
        "source": payload.source_type,
        "description": payload.description or meta.description,
        "row_count": len(df),
        "column_count": len(df.columns),
        "feature_names": meta.feature_names,
        "devices": meta.devices,
        "timestamp_start": meta.timestamp_start,
        "timestamp_end": meta.timestamp_end,
        "label_availability": meta.label_availability,
        "created_at": datetime.now(timezone.utc),
        "quality_summary": q_rep.to_dict(),
        "storage_path": str(safe_path),
    }

    await repo.create_dataset(doc)

    # Ingest initial slice of readings into sensor_readings collection
    sample_readings = []
    features_list = meta.feature_names
    for _, row in df.head(500).iterrows():
        sample_readings.append({
            "reading_id": f"READ_{uuid.uuid4().hex[:12]}",
            "dataset_id": ds_id,
            "device_id": str(row.get("device_id", "default_node")),
            "timestamp": pd.to_datetime(row["timestamp"]).to_pydatetime(),
            "features": {f: float(row[f]) for f in features_list if f in row},
            "ground_truth_label": int(row.get("ground_truth_is_anomaly", 0)),
        })
    await repo.insert_sensor_readings(sample_readings)

    return doc
