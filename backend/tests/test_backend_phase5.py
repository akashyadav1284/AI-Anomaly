"""Integration tests for Phase 5 real-time IoT simulation and WebSocket streaming."""
import asyncio
from datetime import datetime, timezone
import json
import pytest
from httpx import ASGITransport, AsyncClient
from mongomock_motor import AsyncMongoMockClient

from app.db.client import MongoDBManager
from app.db.indexes import initialize_indexes
from app.main import app
from app.services.simulation_engine import sim_engine


@pytest.fixture(autouse=True)
async def setup_test_db():
    """Mock MongoDB with mongomock_motor and verify indexes."""
    client = AsyncMongoMockClient()
    db = client["test_iot_phase5"]
    MongoDBManager.client = client
    MongoDBManager.db = db
    await initialize_indexes(db)
    # Ensure simulator is stopped before and after test
    await sim_engine.reset()
    yield db
    await sim_engine.reset()
    MongoDBManager.client = None
    MongoDBManager.db = None


@pytest.mark.asyncio
async def test_simulator_full_lifecycle():
    """Test start, pause, resume, status checks, and stop operations."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Initial status: stopped
        res_init = await client.get("/api/v1/simulator/status")
        assert res_init.status_code == 200
        assert res_init.json()["status"] == "stopped"

        # 2. Start simulation with 2 devices and anomaly injection
        start_payload = {
            "devices": ["node-alpha", "node-beta"],
            "sampling_rate_hz": 10.0,
            "playback_speed": 1.0,
            "model_name": "isolation_forest",
            "random_seed": 123,
            "persist_to_db": True,
            "anomaly_injections": [
                {
                    "anomaly_type": "spike",
                    "target_channels": ["temperature"],
                    "magnitude": 5.0,
                    "duration_steps": 5,
                    "start_step": 2,
                }
            ],
        }
        res_start = await client.post("/api/v1/simulator/start", json=start_payload)
        assert res_start.status_code == 200
        start_data = res_start.json()
        assert start_data["status"] == "running"
        assert "SIM_" in start_data["simulation_id"]

        # 3. Prevent duplicate starts (409 Conflict)
        res_dup = await client.post("/api/v1/simulator/start", json=start_payload)
        assert res_dup.status_code == 409

        # Let the simulation generate samples
        await asyncio.sleep(0.5)

        # 4. Check status during execution
        res_status = await client.get("/api/v1/simulator/status")
        assert res_status.status_code == 200
        status_data = res_status.json()
        assert status_data["status"] == "running"
        assert status_data["metrics"]["generated_count"] > 0
        assert status_data["metrics"]["inferred_count"] > 0

        # 5. Pause simulation
        res_pause = await client.post("/api/v1/simulator/pause")
        assert res_pause.status_code == 200
        assert res_pause.json()["status"] == "paused"

        count_at_pause = sim_engine.metrics.generated_count
        await asyncio.sleep(0.2)
        # Verify no new readings generated while paused
        assert sim_engine.metrics.generated_count == count_at_pause

        # 6. Resume simulation
        res_resume = await client.post("/api/v1/simulator/resume")
        assert res_resume.status_code == 200
        assert res_resume.json()["status"] == "running"

        await asyncio.sleep(0.2)
        assert sim_engine.metrics.generated_count > count_at_pause

        # 7. Stop simulation
        res_stop = await client.post("/api/v1/simulator/stop")
        assert res_stop.status_code == 200
        assert res_stop.json()["status"] == "stopped"


@pytest.mark.asyncio
async def test_simulator_mongodb_persistence_and_anomalies(setup_test_db):
    """Verify that simulated readings and detected anomalies are persisted into MongoDB."""
    db = setup_test_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        start_payload = {
            "devices": ["sensor-persisted-01"],
            "sampling_rate_hz": 20.0,
            "playback_speed": 1.0,
            "model_name": "isolation_forest",
            "random_seed": 42,
            "persist_to_db": True,
            "anomaly_injections": [
                {
                    "anomaly_type": "spike",
                    "target_channels": ["temperature", "vibration"],
                    "magnitude": 8.0,
                    "duration_steps": 10,
                    "start_step": 0,
                }
            ],
        }
        res_start = await client.post("/api/v1/simulator/start", json=start_payload)
        assert res_start.status_code == 200

        # Allow execution for a brief moment
        await asyncio.sleep(0.6)
        await client.post("/api/v1/simulator/stop")

        # Query database directly
        readings_count = await db.sensor_readings.count_documents({"device_id": "sensor-persisted-01"})
        assert readings_count > 0

        # Verify reading structure
        sample_reading = await db.sensor_readings.find_one({"device_id": "sensor-persisted-01"})
        assert "temperature" in sample_reading["features"]
        assert "vibration" in sample_reading["features"]
        assert isinstance(sample_reading["timestamp"], datetime)

        # Anomalies should have been detected and logged
        anomalies_count = await db.anomalies.count_documents({"device_id": "sensor-persisted-01"})
        assert anomalies_count > 0

        sample_anomaly = await db.anomalies.find_one({"device_id": "sensor-persisted-01"})
        assert sample_anomaly["model_name"] == "isolation_forest"
        assert sample_anomaly["normalized_score"] > 0.5
        assert "temperature" in sample_anomaly["affected_features"]


@pytest.mark.asyncio
async def test_websocket_authentication_and_rejection():
    """Verify WebSocket connection rejects invalid tokens and accepts valid ones."""
    from starlette.testclient import TestClient

    with TestClient(app) as test_client:
        # Invalid token rejection (Policy violation code 1008)
        with pytest.raises(Exception):
            with test_client.websocket_connect("/api/v1/simulator/ws/telemetry?token=bad-token"):
                pass

        # Valid connection with API Key
        with test_client.websocket_connect("/api/v1/simulator/ws/telemetry?token=iot-secret-api-key-2026") as ws:
            ws.send_text("ping")
            response = ws.receive_text()
            data = json.loads(response)
            assert data["event_type"] == "pong"
