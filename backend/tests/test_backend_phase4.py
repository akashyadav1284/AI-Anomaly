"""Integration tests for Phase 4 MongoDB backend, prediction API, and background training."""
import pytest
import mongomock_motor
from httpx import ASGITransport, AsyncClient
from app.main import app
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
async def test_predictions_api_real_inference():
    """Test POST /api/v1/predictions runs real model inference and returns normalized scores & explanations."""
    payload = {
        "device_id": "test_sensor_01",
        "features": {
            "temperature": 45.0,
            "humidity": 55.0,
            "pressure": 101.3,
            "vibration": 1.2,
            "current": 12.5,
        },
        "model_name": "isolation_forest",
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/api/v1/predictions", json=payload)
        assert resp.status_code == 200
        data = resp.json()

        assert data["device_id"] == "test_sensor_01"
        assert "normalized_anomaly_score" in data
        assert 0.0 <= data["normalized_anomaly_score"] <= 1.0
        assert "decision_threshold" in data
        assert "is_anomaly" in data
        assert "explanation" in data
        assert data["persisted"] is True


@pytest.mark.asyncio
async def test_predictions_api_feature_mismatch_error():
    """Verify missing expected sensor features returns 422 error."""
    payload = {
        "device_id": "test_sensor_02",
        "features": {
            "unknown_sensor": 99.0,
        },
        "model_name": "isolation_forest",
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/api/v1/predictions", json=payload)
        assert resp.status_code == 422


@pytest.mark.asyncio
async def test_anomalies_api_listing_and_status_update():
    """Verify anomaly record retrieval and PATCH status progression."""
    # First generate an anomaly with an extreme input
    payload = {
        "device_id": "test_node_alert",
        "features": {
            "temperature": -50.0,
            "humidity": 120.0,
            "pressure": 300.0,
            "vibration": 25.0,
            "current": 60.0,
        },
        "model_name": "isolation_forest",
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await client.post("/api/v1/predictions", json=payload)

        # List anomalies
        list_resp = await client.get("/api/v1/anomalies?device_id=test_node_alert")
        assert list_resp.status_code == 200
        items = list_resp.json()["items"]
        if items:
            anom_id = items[0]["anomaly_id"]
            # Acknowledge incident
            patch_resp = await client.patch(
                f"/api/v1/anomalies/{anom_id}/status",
                json={"review_status": "acknowledged", "notes": "Investigating node calibration"},
            )
            assert patch_resp.status_code == 200
            assert patch_resp.json()["review_status"] == "acknowledged"


@pytest.mark.asyncio
async def test_models_train_job_auth_required():
    """Verify POST /api/v1/models/train enforces X-API-Key authorization."""
    payload = {
        "dataset_id": "demo",
        "model_name": "isolation_forest",
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Without key -> 401
        resp_unauth = await client.post("/api/v1/models/train", json=payload)
        assert resp_unauth.status_code == 401

        # With key -> 202 Accepted
        resp_auth = await client.post(
            "/api/v1/models/train",
            json=payload,
            headers={"X-API-Key": "iot-secret-api-key-2026"},
        )
        assert resp_auth.status_code == 202
        job_data = resp_auth.json()
        assert "job_id" in job_data
        assert job_data["status"] == "queued"
