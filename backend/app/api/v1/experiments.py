"""FastAPI router for experiment tracking, research lab runs, comparison, and export."""
import csv
import io
import json
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.db.client import get_db
from app.repositories.mongo_repo import MongoRepository
from app.schemas.api_v1 import ExperimentCreateRequest, ExperimentResponse
from ml.evaluation.experiments import ResearchExperimentRunner
from ml.data.generators.sensor_generator import IoTSensorGenerator
from ml.training.trainer import ModelTrainer

router = APIRouter(prefix="/experiments", tags=["Experiments"])


@router.get("", response_model=List[ExperimentResponse])
async def list_experiments(db: AsyncIOMotorDatabase = Depends(get_db)):
    repo = MongoRepository(db)
    return await repo.list_experiments()


@router.get("/benchmark", response_model=List[Dict[str, Any]])
async def run_benchmark(
    sample_count: int = Query(1000, ge=100, le=5000),
    seed: int = Query(42),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Run real multi-algorithm evaluation benchmark across the model suite."""
    results = ResearchExperimentRunner.run_benchmark_comparison(
        sample_count=sample_count,
        random_seed=seed,
    )
    repo = MongoRepository(db)
    # Persist benchmark runs to MongoDB
    for res in results:
        doc = {
            "experiment_id": f"BENCH_{uuid.uuid4().hex[:8]}",
            "name": f"Benchmark_{res['model_name']}",
            "dataset_id": "synthetic_iot_v1",
            "model_name": res["model_name"],
            "status": res["status"],
            "created_at": datetime.now(timezone.utc),
            "metrics": {
                "precision": res.get("precision"),
                "recall": res.get("recall"),
                "f1_score": res.get("f1_score"),
                "pr_auc": res.get("pr_auc"),
                "roc_auc": res.get("roc_auc"),
                "detection_delay": res.get("detection_delay"),
                "event_recall": res.get("event_recall"),
            },
        }
        await repo.create_experiment(doc)
    return results


@router.get("/robustness/noise", response_model=List[Dict[str, Any]])
async def run_noise_experiment(
    model_name: str = Query("isolation_forest"),
    seed: int = Query(42),
):
    """Run noise sensitivity test with increasing sensor variance."""
    return ResearchExperimentRunner.run_noise_sensitivity_experiment(
        model_name=model_name,
        random_seed=seed,
    )


@router.get("/export/csv")
async def export_experiments_csv(db: AsyncIOMotorDatabase = Depends(get_db)):
    """Export stored experiments as CSV."""
    repo = MongoRepository(db)
    experiments = await repo.list_experiments()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "experiment_id",
        "name",
        "dataset_id",
        "model_name",
        "status",
        "precision",
        "recall",
        "f1_score",
        "created_at",
    ])

    for exp in experiments:
        m = exp.get("metrics") or {}
        writer.writerow([
            exp.get("experiment_id"),
            exp.get("name"),
            exp.get("dataset_id"),
            exp.get("model_name"),
            exp.get("status"),
            m.get("precision", "N/A"),
            m.get("recall", "N/A"),
            m.get("f1_score", "N/A"),
            exp.get("created_at"),
        ])

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=experiments_{int(datetime.now().timestamp())}.csv"},
    )


@router.get("/export/json")
async def export_experiments_json(db: AsyncIOMotorDatabase = Depends(get_db)):
    """Export stored experiments as JSON."""
    repo = MongoRepository(db)
    experiments = await repo.list_experiments()
    return Response(
        content=json.dumps(experiments, default=str, indent=2),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename=experiments_{int(datetime.now().timestamp())}.json"},
    )


@router.get("/{experiment_id}", response_model=ExperimentResponse)
async def get_experiment(experiment_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    repo = MongoRepository(db)
    exp = await repo.get_experiment(experiment_id)
    if not exp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Experiment '{experiment_id}' not found.")
    return exp


@router.post("", response_model=ExperimentResponse, status_code=status.HTTP_201_CREATED)
async def create_experiment(payload: ExperimentCreateRequest, db: AsyncIOMotorDatabase = Depends(get_db)):
    repo = MongoRepository(db)
    exp_id = f"EXP_{uuid.uuid4().hex[:10]}"

    # Run real trainer evaluation
    trainer = ModelTrainer(random_state=payload.seed)
    gen = IoTSensorGenerator(random_state=payload.seed)
    df = gen.generate(n_rows=500, devices=["sensor_node_01"], anomaly_rate=0.08, inject_anomalies=True)
    train_out = trainer.train(
        df=df,
        model_name=payload.model_name,
        scaler_type=payload.scaler_type,
    )
    pm = train_out["metrics"].get("point_metrics", {})
    em = train_out["metrics"].get("event_metrics", {})

    doc = {
        "experiment_id": exp_id,
        "name": payload.experiment_name,
        "dataset_id": payload.dataset_id,
        "model_name": payload.model_name,
        "status": "completed",
        "created_at": datetime.now(timezone.utc),
        "parameters": payload.model_dump(),
        "metrics": {
            "f1_score": round(float(pm.get("f1_score", 0.0)), 4),
            "precision": round(float(pm.get("precision", 0.0)), 4),
            "recall": round(float(pm.get("recall", 0.0)), 4),
            "pr_auc": round(float(pm.get("pr_auc", 0.0)), 4),
            "roc_auc": round(float(pm.get("roc_auc", 0.0)), 4),
            "detection_delay": round(float(em.get("mean_detection_delay", 0.0)), 2),
            "event_recall": round(float(em.get("event_recall", 0.0)), 4),
        },
    }
    await repo.create_experiment(doc)
    return doc
