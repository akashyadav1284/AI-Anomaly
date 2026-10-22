"""Integration tests for Phase 7 & 8: Research Lab, Benchmarks, Security & Rate Limiting."""
import asyncio
import json
import pytest
from httpx import ASGITransport, AsyncClient
from mongomock_motor import AsyncMongoMockClient

from app.db.client import MongoDBManager
from app.db.indexes import initialize_indexes
from app.main import app


@pytest.fixture(autouse=True)
async def setup_test_db():
    client = AsyncMongoMockClient()
    db = client["test_iot_phase7_8"]
    MongoDBManager.client = client
    MongoDBManager.db = db
    await initialize_indexes(db)
    yield db
    MongoDBManager.client = None
    MongoDBManager.db = None


@pytest.mark.asyncio
async def test_security_headers_enforced():
    """Verify security headers (X-Frame-Options, X-Content-Type-Options) on API responses."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/v1/health")
        assert resp.status_code == 200
        assert resp.headers.get("X-Frame-Options") == "DENY"
        assert resp.headers.get("X-Content-Type-Options") == "nosniff"
        assert resp.headers.get("Strict-Transport-Security") is not None


@pytest.mark.asyncio
async def test_experiments_create_and_real_evaluation():
    """Verify POST /api/v1/experiments executes actual model trainer and logs real metrics."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        payload = {
            "experiment_name": "Test_Isolation_Forest_Exp",
            "dataset_id": "synthetic_iot_v1",
            "model_name": "isolation_forest",
            "model_params": {"n_estimators": 50},
            "seed": 42,
        }
        resp = await client.post("/api/v1/experiments", json=payload)
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "Test_Isolation_Forest_Exp"
        assert data["status"] == "completed"
        assert "metrics" in data
        assert 0.0 <= data["metrics"]["f1_score"] <= 1.0
        assert 0.0 <= data["metrics"]["precision"] <= 1.0


@pytest.mark.asyncio
async def test_experiments_export_csv_and_json():
    """Verify CSV and JSON export routes for experiment tracking."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Create an experiment first
        await client.post(
            "/api/v1/experiments",
            json={
                "experiment_name": "Export_Test_Run",
                "dataset_id": "synthetic_iot_v1",
                "model_name": "isolation_forest",
                "seed": 42,
            },
        )

        # Export CSV
        resp_csv = await client.get("/api/v1/experiments/export/csv")
        assert resp_csv.status_code == 200
        assert "text/csv" in resp_csv.headers["content-type"]
        assert "Export_Test_Run" in resp_csv.text

        # Export JSON
        resp_json = await client.get("/api/v1/experiments/export/json")
        assert resp_json.status_code == 200
        assert "application/json" in resp_json.headers["content-type"]
        parsed = json.loads(resp_json.text)
        assert isinstance(parsed, list)
        assert len(parsed) >= 1


@pytest.mark.asyncio
async def test_path_traversal_prevention_on_import():
    """Verify that importing external dataset files prevents path traversal."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            "/api/v1/datasets/import",
            json={
                "dataset_name": "Malicious_Path",
                "source_type": "generic_csv",
                "server_file_path": "../../../etc/passwd",
            },
        )
        assert resp.status_code in (400, 422)
