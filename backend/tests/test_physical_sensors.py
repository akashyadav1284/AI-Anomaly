"""Integration tests for physical IoT sensor hardware ingestion (ESP32 node)."""
import pytest
import mongomock_motor
from httpx import ASGITransport, AsyncClient
from app.main import app
from app.core.config import get_settings
from app.db.client import MongoDBManager
from app.db.indexes import initialize_indexes


@pytest.fixture(autouse=True)
async def setup_test_db():
    """Setup isolated in-memory MongoMock database for testing."""
    client = mongomock_motor.AsyncMongoMockClient()
    db = client["test_iot_anomaly_detection"]
    MongoDBManager.client = client
    MongoDBManager.db = db
    await initialize_indexes(db)
    yield db
    MongoDBManager.client = None
    MongoDBManager.db = None


@pytest.mark.asyncio
async def test_physical_telemetry_auth_required():
    """Verify that physical telemetry ingestion rejects requests missing the X-API-Key header."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            "/api/v1/sensors/telemetry",
            json={
                "device_id": "ESP32_UNAUTHORIZED",
                "sensors": {
                    "temperature": 25.0,
                    "humidity": 50.0,
                    "accel_x": 0.0,
                    "accel_y": 0.0,
                    "accel_z": 9.81,
                },
            },
        )
        assert resp.status_code == 401


@pytest.mark.asyncio
async def test_physical_telemetry_ingestion_success():
    """Verify valid ESP32 physical telemetry ingestion, physics derivation, and response."""
    settings = get_settings()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        payload = {
            "device_id": "ESP32_PHYSICAL_TEST_01",
            "source": "physical",
            "sequence": 1,
            "sensors": {
                "temperature": 27.5,
                "humidity": 58.2,
                "accel_x": 0.12,
                "accel_y": 0.05,
                "accel_z": 9.82,
                "gyro_x": 0.01,
                "gyro_y": 0.0,
                "gyro_z": -0.01,
            },
        }
        resp = await client.post(
            "/api/v1/sensors/telemetry",
            json=payload,
            headers={"X-API-Key": settings.API_KEY},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["status"] == "success"
        assert data["device_id"] == "ESP32_PHYSICAL_TEST_01"
        assert "reading_id" in data
        assert "prediction" in data


@pytest.mark.asyncio
async def test_physical_telemetry_out_of_bounds_validation():
    """Verify that impossible physical sensor readings are rejected (e.g. humidity > 100%)."""
    settings = get_settings()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        invalid_payload = {
            "device_id": "ESP32_PHYSICAL_ERR",
            "sensors": {
                "temperature": 25.0,
                "humidity": 150.0,  # Invalid: > 100%
                "accel_x": 0.0,
                "accel_y": 0.0,
                "accel_z": 9.81,
            },
        }
        resp = await client.post(
            "/api/v1/sensors/telemetry",
            json=invalid_payload,
            headers={"X-API-Key": settings.API_KEY},
        )
        assert resp.status_code == 422


@pytest.mark.asyncio
async def test_devices_status_endpoint():
    """Verify that /api/v1/sensors/devices/status reports connectivity and health metrics."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/v1/sensors/devices/status")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
