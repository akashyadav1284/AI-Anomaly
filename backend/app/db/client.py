"""Async MongoDB client lifecycle and connection accessors."""
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.core.config import get_settings
from app.core.logging import setup_logging

logger = setup_logging()


class MongoDBManager:
    """Manages AsyncIOMotorClient connections."""

    client: Optional[AsyncIOMotorClient] = None
    db: Optional[AsyncIOMotorDatabase] = None

    @classmethod
    async def connect_to_database(cls, uri: Optional[str] = None, db_name: Optional[str] = None) -> None:
        settings = get_settings()
        target_uri = uri or settings.MONGODB_URI
        target_db = db_name or settings.DATABASE_NAME

        try:
            cls.client = AsyncIOMotorClient(
                target_uri,
                maxPoolSize=settings.MONGODB_MAX_POOL_SIZE,
                minPoolSize=settings.MONGODB_MIN_POOL_SIZE,
                serverSelectionTimeoutMS=settings.MONGODB_TIMEOUT_MS,
            )
            cls.db = cls.client[target_db]
            await cls.client.admin.command("ping")
            logger.info("Successfully connected to MongoDB at %s (DB: %s)", target_uri, target_db)
        except Exception as e:
            logger.warning("MongoDB ping failed on startup: %s. Operations requiring DB will fail safely.", e)

    @classmethod
    async def close_database_connection(cls) -> None:
        if cls.client:
            cls.client.close()
            cls.client = None
            cls.db = None
            logger.info("Closed MongoDB database connection.")

    @classmethod
    def get_database(cls) -> AsyncIOMotorDatabase:
        if cls.db is None:
            raise RuntimeError("Database connection has not been initialized.")
        return cls.db

    @classmethod
    async def is_connected(cls) -> bool:
        if not cls.client:
            return False
        try:
            await cls.client.admin.command("ping")
            return True
        except Exception:
            return False


def get_db() -> AsyncIOMotorDatabase:
    """FastAPI dependency for accessing active MongoDB database."""
    return MongoDBManager.get_database()
