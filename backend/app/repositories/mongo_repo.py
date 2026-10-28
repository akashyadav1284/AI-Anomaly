"""MongoDB repository layer managing database operations across collections."""
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
import pymongo
from motor.motor_asyncio import AsyncIOMotorDatabase


class MongoRepository:
    """Encapsulates asynchronous queries against MongoDB collections."""

    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db

    # ==========================
    # Datasets
    # ==========================
    async def create_dataset(self, doc: Dict[str, Any]) -> None:
        await self.db.datasets.insert_one(doc)

    async def get_dataset(self, dataset_id: str) -> Optional[Dict[str, Any]]:
        return await self.db.datasets.find_one({"dataset_id": dataset_id}, {"_id": 0})

    async def list_datasets(self, skip: int = 0, limit: int = 50) -> Tuple[List[Dict[str, Any]], int]:
        total = await self.db.datasets.count_documents({})
        cursor = self.db.datasets.find({}, {"_id": 0}).sort("created_at", pymongo.DESCENDING).skip(skip).limit(limit)
        items = await cursor.to_list(length=limit)
        return items, total

    # ==========================
    # Sensor Readings
    # ==========================
    async def insert_sensor_readings(self, docs: List[Dict[str, Any]]) -> None:
        if docs:
            await self.db.sensor_readings.insert_many(docs)

    async def list_sensors(self) -> List[Dict[str, Any]]:
        pipeline = [
            {
                "$group": {
                    "_id": "$device_id",
                    "device_id": {"$first": "$device_id"},
                    "dataset_id": {"$first": "$dataset_id"},
                    "first_seen": {"$min": "$timestamp"},
                    "last_seen": {"$max": "$timestamp"},
                    "total_readings": {"$sum": 1},
                }
            },
            {"$project": {"_id": 0}},
        ]
        return await self.db.sensor_readings.aggregate(pipeline).to_list(length=100)

    async def get_device_readings(
        self,
        device_id: str,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> Tuple[List[Dict[str, Any]], int]:
        query: Dict[str, Any] = {"device_id": device_id}
        if start_time or end_time:
            query["timestamp"] = {}
            if start_time:
                query["timestamp"]["$gte"] = start_time
            if end_time:
                query["timestamp"]["$lte"] = end_time

        total = await self.db.sensor_readings.count_documents(query)
        # Exclude ground truth label from ordinary sensor queries
        cursor = self.db.sensor_readings.find(query, {"_id": 0, "ground_truth_label": 0}).sort(
            "timestamp", pymongo.ASCENDING
        ).skip(skip).limit(limit)
        items = await cursor.to_list(length=limit)
        return items, total

    # ==========================
    # Anomalies
    # ==========================
    async def insert_anomaly(self, doc: Dict[str, Any]) -> None:
        await self.db.anomalies.insert_one(doc)

    async def get_anomaly(self, anomaly_id: str) -> Optional[Dict[str, Any]]:
        return await self.db.anomalies.find_one({"anomaly_id": anomaly_id}, {"_id": 0})

    async def list_anomalies(
        self,
        device_id: Optional[str] = None,
        severity: Optional[str] = None,
        review_status: Optional[str] = None,
        search: Optional[str] = None,
        sort_by: str = "timestamp",
        order: str = "desc",
        skip: int = 0,
        limit: int = 50,
    ) -> Tuple[List[Dict[str, Any]], int]:
        query: Dict[str, Any] = {}
        if device_id and device_id.lower() != "all":
            query["device_id"] = device_id
        if severity and severity.lower() != "all":
            query["severity"] = {"$regex": f"^{severity}$", "$options": "i"}
        if review_status and review_status.lower() != "all":
            query["review_status"] = {"$regex": f"^{review_status}$", "$options": "i"}
        if search:
            query["$or"] = [
                {"anomaly_id": {"$regex": search, "$options": "i"}},
                {"device_id": {"$regex": search, "$options": "i"}},
                {"model_name": {"$regex": search, "$options": "i"}},
            ]

        direction = pymongo.DESCENDING if order.lower() == "desc" else pymongo.ASCENDING
        sort_field = sort_by if sort_by in ["timestamp", "normalized_score", "raw_score", "severity"] else "timestamp"

        total = await self.db.anomalies.count_documents(query)
        cursor = self.db.anomalies.find(query, {"_id": 0}).sort(sort_field, direction).skip(skip).limit(limit)
        items = await cursor.to_list(length=limit)
        return items, total

    async def update_anomaly_status(self, anomaly_id: str, status: str, notes: Optional[str] = None) -> Optional[Dict[str, Any]]:
        update_doc: Dict[str, Any] = {"review_status": status}
        now = datetime.now(timezone.utc)
        if status in ["acknowledged", "under_review"]:
            update_doc["acknowledged_at"] = now
        elif status in ["resolved", "false_positive", "confirmed"]:
            update_doc["resolved_at"] = now

        if notes is not None:
            update_doc["notes"] = notes

        res = await self.db.anomalies.find_one_and_update(
            {"anomaly_id": anomaly_id},
            {"$set": update_doc},
            return_document=pymongo.ReturnDocument.AFTER,
            projection={"_id": 0},
        )
        return res

    async def update_anomalies_bulk(
        self,
        anomaly_ids: List[str],
        status: str,
        notes: Optional[str] = None,
    ) -> int:
        update_doc: Dict[str, Any] = {"review_status": status}
        now = datetime.now(timezone.utc)
        if status in ["acknowledged", "under_review"]:
            update_doc["acknowledged_at"] = now
        elif status in ["resolved", "false_positive", "confirmed"]:
            update_doc["resolved_at"] = now

        if notes is not None:
            update_doc["notes"] = notes

        result = await self.db.anomalies.update_many(
            {"anomaly_id": {"$in": anomaly_ids}},
            {"$set": update_doc},
        )
        return result.modified_count

    # ==========================
    # Models & Jobs
    # ==========================
    async def create_model(self, doc: Dict[str, Any]) -> None:
        await self.db.models.insert_one(doc)

    async def get_model(self, model_id: str) -> Optional[Dict[str, Any]]:
        return await self.db.models.find_one({"model_id": model_id}, {"_id": 0})

    async def list_models(self) -> List[Dict[str, Any]]:
        cursor = self.db.models.find({}, {"_id": 0}).sort("created_at", pymongo.DESCENDING)
        return await cursor.to_list(length=100)

    async def create_job(self, doc: Dict[str, Any]) -> None:
        await self.db.training_jobs.insert_one(doc)

    async def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        return await self.db.training_jobs.find_one({"job_id": job_id}, {"_id": 0})

    async def update_job(self, job_id: str, fields: Dict[str, Any]) -> None:
        await self.db.training_jobs.update_one({"job_id": job_id}, {"$set": fields})

    # ==========================
    # Experiments
    # ==========================
    async def create_experiment(self, doc: Dict[str, Any]) -> None:
        await self.db.experiments.insert_one(doc)

    async def get_experiment(self, exp_id: str) -> Optional[Dict[str, Any]]:
        return await self.db.experiments.find_one({"experiment_id": exp_id}, {"_id": 0})

    async def list_experiments(self) -> List[Dict[str, Any]]:
        cursor = self.db.experiments.find({}, {"_id": 0}).sort("created_at", pymongo.DESCENDING)
        return await cursor.to_list(length=100)


from typing import Tuple
