"""FastAPI router for dataset cataloging, quality audits, ingestion, and preprocessing."""
import io
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from motor.motor_asyncio import AsyncIOMotorDatabase
import numpy as np
import pandas as pd

from app.db.client import get_db
from app.repositories.mongo_repo import MongoRepository
from app.schemas.api_v1 import (
    DatasetImportRequest,
    DatasetPreprocessingRequest,
    DatasetResponse,
    PaginatedResponse,
    PaginationMeta,
    SyntheticDatasetGenerateRequest,
)
from ml.data.generators.sensor_generator import IoTSensorGenerator
from ml.data.loaders.generic_csv_loader import GenericCSVLoader
from ml.data.loaders.nab_loader import NABLoader
from ml.data.loaders.nasa_loader import NASALoader
from ml.data.validation.quality_report import QualityReporter

router = APIRouter(prefix="/datasets", tags=["Datasets"])

UPLOAD_DIR = Path("uploads/datasets")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@router.get("", response_model=PaginatedResponse)
async def list_datasets(
    source: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Retrieve all cataloged datasets with optional search and source filtering."""
    repo = MongoRepository(db)
    skip = (page - 1) * page_size
    items, total = await repo.list_datasets(source=source, search=search, skip=skip, limit=page_size)
    total_pages = (total + page_size - 1) // page_size if total > 0 else 1
    return PaginatedResponse(
        items=items,
        pagination=PaginationMeta(page=page, page_size=page_size, total_count=total, total_pages=total_pages),
    )


@router.get("/{dataset_id}", response_model=DatasetResponse)
async def get_dataset(dataset_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Retrieve full metadata for a specific dataset."""
    repo = MongoRepository(db)
    ds = await repo.get_dataset(dataset_id)
    if not ds:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Dataset '{dataset_id}' not found.")
    return ds


@router.get("/{dataset_id}/preview")
async def get_dataset_preview(
    dataset_id: str,
    limit: int = Query(25, ge=1, le=100),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Retrieve sample preview rows and column types for time-series charts and tables."""
    repo = MongoRepository(db)
    ds = await repo.get_dataset(dataset_id)
    if not ds:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Dataset '{dataset_id}' not found.")

    storage_path = ds.get("storage_path")
    if storage_path and Path(storage_path).exists():
        p = Path(storage_path)
        if p.suffix == ".parquet":
            df = pd.read_parquet(p)
        else:
            df = pd.read_csv(p)
        sample_df = df.head(limit)
        # Convert timestamp to string if present
        if "timestamp" in sample_df.columns:
            sample_df["timestamp"] = sample_df["timestamp"].astype(str)
        return {
            "dataset_id": ds["dataset_id"],
            "total_rows": len(df),
            "columns": list(df.columns),
            "preview": sample_df.to_dict(orient="records"),
        }

    # Fallback to sensor readings collection
    readings = await db.sensor_readings.find(
        {"dataset_id": ds["dataset_id"]}, {"_id": 0}
    ).sort("timestamp", 1).limit(limit).to_list(length=limit)

    return {
        "dataset_id": ds["dataset_id"],
        "total_rows": ds.get("row_count", 0),
        "columns": ds.get("feature_names", []),
        "preview": readings,
    }


@router.get("/{dataset_id}/audit")
@router.get("/{dataset_id}/quality")
async def run_or_get_dataset_audit(dataset_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Execute real-time Data Quality Audit engine or retrieve cached audit findings."""
    repo = MongoRepository(db)
    ds = await repo.get_dataset(dataset_id)
    if not ds:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Dataset '{dataset_id}' not found.")

    storage_path = ds.get("storage_path")
    if storage_path and Path(storage_path).exists():
        p = Path(storage_path)
        df = pd.read_parquet(p) if p.suffix == ".parquet" else pd.read_csv(p)
        if "timestamp" in df.columns:
            df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)
        reporter = QualityReporter()
        q_rep = reporter.generate_report(df)
        audit_dict = q_rep.to_dict()

        # Update cache in Mongo
        await repo.update_dataset_quality(ds["dataset_id"], audit_dict)
        return audit_dict

    # Return existing summary
    return ds.get("quality_summary") or {
        "dataset_name": ds.get("name"),
        "is_valid": True,
        "row_count": ds.get("row_count", 0),
        "errors": [],
        "warnings": [],
    }


@router.post("/generate-synthetic", response_model=DatasetResponse, status_code=status.HTTP_201_CREATED)
async def generate_synthetic_dataset(
    payload: SyntheticDatasetGenerateRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Generate high-fidelity synthetic IoT telemetry dataset and register into catalog."""
    repo = MongoRepository(db)
    ds_id = f"DS_SYNTH_{uuid.uuid4().hex[:8]}"

    devices = [f"sensor_node_{i+1:02d}" for i in range(payload.device_count)]
    gen = IoTSensorGenerator(random_state=payload.random_seed, dataset_id=ds_id)
    df = gen.generate(
        n_rows=payload.samples_per_device,
        devices=devices,
        freq=payload.sampling_freq,
        inject_anomalies=payload.inject_anomalies,
        anomaly_rate=payload.anomaly_rate,
    )

    # Save to disk
    file_path = UPLOAD_DIR / f"{ds_id}.csv"
    df.to_csv(file_path, index=False)

    reporter = QualityReporter()
    q_rep = reporter.generate_report(df)

    feature_cols = [c for c in df.columns if c not in ["timestamp", "device_id", "dataset_id", "ground_truth_is_anomaly", "anomaly_type", "event_id"]]

    doc = {
        "dataset_id": ds_id,
        "name": payload.dataset_name,
        "source": "synthetic",
        "description": payload.description or f"Synthetic multi-variate telemetry generated with seed {payload.random_seed}",
        "row_count": len(df),
        "column_count": len(df.columns),
        "feature_names": feature_cols,
        "devices": devices,
        "timestamp_start": df["timestamp"].min().isoformat() if not df.empty else None,
        "timestamp_end": df["timestamp"].max().isoformat() if not df.empty else None,
        "label_availability": payload.inject_anomalies,
        "created_at": datetime.now(timezone.utc),
        "audited_at": datetime.now(timezone.utc),
        "quality_summary": q_rep.to_dict(),
        "storage_path": str(file_path),
    }

    await repo.create_dataset(doc)

    # Ingest slice of readings for streaming/preview
    sample_readings = []
    for _, row in df.head(300).iterrows():
        sample_readings.append({
            "reading_id": f"READ_{uuid.uuid4().hex[:12]}",
            "dataset_id": ds_id,
            "device_id": str(row.get("device_id", "sensor_node_01")),
            "timestamp": pd.to_datetime(row["timestamp"]).to_pydatetime(),
            "features": {f: float(row[f]) for f in feature_cols if f in row},
            "ground_truth_label": int(row.get("ground_truth_is_anomaly", 0)),
        })
    await repo.insert_sensor_readings(sample_readings)

    return doc


@router.post("/upload", response_model=DatasetResponse, status_code=status.HTTP_201_CREATED)
async def upload_dataset_file(
    file: UploadFile = File(...),
    dataset_name: str = Form(...),
    description: Optional[str] = Form(None),
    source_type: str = Form("generic"),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Upload CSV or Parquet sensor dataset, validate schema, execute audit, and register."""
    filename = file.filename or "telemetry.csv"
    ext = Path(filename).suffix.lower()
    if ext not in [".csv", ".parquet"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only .csv and .parquet formats supported.")

    ds_id = f"DS_UP_{uuid.uuid4().hex[:8]}"
    save_path = UPLOAD_DIR / f"{ds_id}_{filename}"

    content = await file.read()
    if len(content) > 25 * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File size exceeds maximum limit of 25MB.")

    with open(save_path, "wb") as f:
        f.write(content)

    if ext == ".parquet":
        df = pd.read_parquet(save_path)
    else:
        df = pd.read_csv(save_path)

    # Ingest with loader
    if source_type == "nab":
        loader = NABLoader(dataset_id=ds_id)
        loaded = loader.load(save_path)
        df = loaded.data
        meta = loaded.metadata
    elif source_type == "nasa":
        loader = NASALoader(dataset_id=ds_id)
        loaded = loader.load(save_path)
        df = loaded.data
        meta = loaded.metadata
    else:
        loader = GenericCSVLoader(timestamp_col="timestamp" if "timestamp" in df.columns else None, dataset_id=ds_id)
        loaded = loader.load(save_path)
        df = loaded.data
        meta = loaded.metadata

    reporter = QualityReporter()
    q_rep = reporter.generate_report(df)

    doc = {
        "dataset_id": ds_id,
        "name": dataset_name,
        "source": source_type,
        "description": description or f"Imported from {filename} ({len(df)} rows)",
        "row_count": len(df),
        "column_count": len(df.columns),
        "feature_names": meta.feature_names,
        "devices": meta.devices,
        "timestamp_start": meta.timestamp_start,
        "timestamp_end": meta.timestamp_end,
        "label_availability": meta.label_availability,
        "created_at": datetime.now(timezone.utc),
        "audited_at": datetime.now(timezone.utc),
        "quality_summary": q_rep.to_dict(),
        "storage_path": str(save_path),
    }

    repo = MongoRepository(db)
    await repo.create_dataset(doc)

    return doc


@router.post("/preprocess")
async def preprocess_dataset(
    payload: DatasetPreprocessingRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Execute robust time-series preprocessing, train/val/test splits, and return summary metrics."""
    repo = MongoRepository(db)
    ds = await repo.get_dataset(payload.dataset_id)
    if not ds:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Dataset '{payload.dataset_id}' not found.")

    storage_path = ds.get("storage_path")
    if not storage_path or not Path(storage_path).exists():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Raw storage file not available for preprocessing.")

    p = Path(storage_path)
    df = pd.read_parquet(p) if p.suffix == ".parquet" else pd.read_csv(p)

    initial_rows = len(df)
    initial_dupes = int(df.duplicated().sum())

    if payload.drop_duplicates:
        df = df.drop_duplicates()

    # Handle missing
    if payload.handle_missing == "drop":
        df = df.dropna()
    elif payload.handle_missing == "forward_fill":
        df = df.ffill().bfill()
    elif payload.handle_missing == "mean":
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        df[numeric_cols] = df[numeric_cols].fillna(df[numeric_cols].mean())

    final_rows = len(df)
    train_size = int(final_rows * payload.train_split_ratio)
    val_size = int(final_rows * payload.val_split_ratio)
    test_size = max(0, final_rows - train_size - val_size)

    return {
        "dataset_id": ds["dataset_id"],
        "dataset_name": ds["name"],
        "initial_rows": initial_rows,
        "final_rows": final_rows,
        "removed_duplicates": initial_dupes if payload.drop_duplicates else 0,
        "missing_strategy": payload.handle_missing,
        "splits": {
            "train_samples": train_size,
            "val_samples": val_size,
            "test_samples": test_size,
        },
        "status": "ready_for_training",
    }


@router.delete("/{dataset_id}")
async def delete_dataset(dataset_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Remove a dataset entry from catalog."""
    repo = MongoRepository(db)
    deleted = await repo.delete_dataset(dataset_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Dataset '{dataset_id}' not found.")
    return {"status": "success", "message": f"Dataset '{dataset_id}' deleted."}
