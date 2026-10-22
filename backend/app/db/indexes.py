"""Idempotent index creation routines for MongoDB collections."""
from motor.motor_asyncio import AsyncIOMotorDatabase
import pymongo
from app.core.logging import setup_logging

logger = setup_logging()


async def initialize_indexes(db: AsyncIOMotorDatabase) -> None:
    """Create indexes for all collections idempotently."""
    logger.info("Initializing MongoDB indexes...")

    # 1. datasets
    await db.datasets.create_index([("dataset_id", pymongo.ASCENDING)], unique=True)
    await db.datasets.create_index([("created_at", pymongo.DESCENDING)])

    # 2. sensor_readings
    await db.sensor_readings.create_index([("device_id", pymongo.ASCENDING), ("timestamp", pymongo.ASCENDING)])
    await db.sensor_readings.create_index([("dataset_id", pymongo.ASCENDING), ("timestamp", pymongo.ASCENDING)])
    await db.sensor_readings.create_index([("timestamp", pymongo.DESCENDING)])

    # 3. anomalies
    await db.anomalies.create_index([("anomaly_id", pymongo.ASCENDING)], unique=True)
    await db.anomalies.create_index([("device_id", pymongo.ASCENDING), ("timestamp", pymongo.DESCENDING)])
    await db.anomalies.create_index([("review_status", pymongo.ASCENDING)])
    await db.anomalies.create_index([("severity", pymongo.ASCENDING)])

    # 4. models
    await db.models.create_index([("model_id", pymongo.ASCENDING)], unique=True)
    await db.models.create_index([("model_name", pymongo.ASCENDING), ("model_version", pymongo.ASCENDING)])

    # 5. experiments
    await db.experiments.create_index([("experiment_id", pymongo.ASCENDING)], unique=True)
    await db.experiments.create_index([("status", pymongo.ASCENDING)])
    await db.experiments.create_index([("created_at", pymongo.DESCENDING)])

    # 6. simulations
    await db.simulations.create_index([("simulation_id", pymongo.ASCENDING)], unique=True)
    await db.simulations.create_index([("status", pymongo.ASCENDING)])

    logger.info("MongoDB indexes successfully verified.")
