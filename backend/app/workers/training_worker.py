"""Background training worker tracking job progression asynchronously."""
import asyncio
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict
import pandas as pd
from app.core.logging import setup_logging
from app.repositories.mongo_repo import MongoRepository
from ml.training.trainer import ModelTrainer

logger = setup_logging()


async def run_training_job_async(
    job_id: str,
    dataset_path: str,
    model_name: str,
    model_params: Dict[str, Any],
    scaler_type: str,
    contamination: float,
    seed: int,
    repo: MongoRepository,
) -> None:
    """Asynchronous background worker executing model training and updating job status in MongoDB."""
    logger.info("Starting background training job %s for model '%s'...", job_id, model_name)

    await repo.update_job(job_id, {"status": "running", "progress_percentage": 10.0})

    try:
        p = Path(dataset_path)
        if not p.exists():
            raise FileNotFoundError(f"Training dataset not found: {p}")

        if p.suffix.lower() == ".csv":
            df = pd.read_csv(p)
        else:
            df = pd.read_parquet(p)

        if "timestamp" in df.columns:
            df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)

        await repo.update_job(job_id, {"progress_percentage": 40.0})

        out_dir = Path("artifacts/models") / model_name
        trainer = ModelTrainer(random_state=seed)

        # Execute training in default threadpool to avoid blocking asyncio event loop
        loop = asyncio.get_running_loop()
        result = await loop.run_in_executor(
            None,
            lambda: trainer.train(
                df=df,
                model_name=model_name,
                model_params=model_params,
                scaler_type=scaler_type,
                contamination=contamination,
                output_dir=out_dir,
            ),
        )

        await repo.update_job(job_id, {"progress_percentage": 90.0})

        # Register model document in MongoDB
        model_doc = {
            "model_id": f"MOD_{model_name}_{int(datetime.now(timezone.utc).timestamp())}",
            "model_name": model_name,
            "model_version": result["model"].model_version,
            "algorithm": model_name,
            "feature_names": result["pipeline"].feature_names_,
            "threshold": result["model"].threshold,
            "threshold_method": result["model"].threshold_method,
            "status": "ready",
            "artifact_uri": str(out_dir.resolve()),
            "created_at": datetime.now(timezone.utc),
            "evaluation_metrics": result.get("metrics"),
        }
        await repo.create_model(model_doc)

        # Mark job complete
        await repo.update_job(
            job_id,
            {
                "status": "completed",
                "progress_percentage": 100.0,
                "completed_at": datetime.now(timezone.utc),
                "result_data": {
                    "model_id": model_doc["model_id"],
                    "threshold": model_doc["threshold"],
                    "metrics": model_doc["evaluation_metrics"],
                },
            },
        )
        logger.info("Training job %s successfully completed.", job_id)

    except Exception as e:
        logger.error("Training job %s failed: %s", job_id, e, exc_info=True)
        await repo.update_job(
            job_id,
            {
                "status": "failed",
                "completed_at": datetime.now(timezone.utc),
                "error_message": str(e),
            },
        )
