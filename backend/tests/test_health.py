"""Test suite for health and readiness endpoints."""
import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app


@pytest.mark.asyncio
async def test_health_endpoint():
    """Verify that /api/v1/health returns 200 and valid status schema."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert "version" in data
        assert "app_name" in data
        assert "timestamp" in data


@pytest.mark.asyncio
async def test_readiness_endpoint():
    """Verify that /api/v1/ready accurately reports component states based on MongoDB connectivity."""
    from unittest.mock import patch
    with patch("app.db.client.MongoDBManager.is_connected", return_value=True):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/api/v1/ready")
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "ready"
            assert "components" in data
            assert data["components"]["api_server"]["ready"] is True
            assert data["components"]["database"]["ready"] is True

    with patch("app.db.client.MongoDBManager.is_connected", return_value=False):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/api/v1/ready")
            assert response.status_code == 503
            data = response.json()
            assert data["status"] == "not_ready"
            assert data["components"]["database"]["ready"] is False


@pytest.mark.asyncio
async def test_404_standardized_error_format():
    """Verify that unmapped routes return consistent JSON error envelopes."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/non-existent-endpoint")
        assert response.status_code == 404
        data = response.json()
        assert data["success"] is False
        assert "error" in data
        assert data["error"]["code"] == "HTTP_404"
        assert "timestamp" in data
