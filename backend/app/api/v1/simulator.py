"""FastAPI router for streaming simulation management and lifecycle controls."""
from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.config import get_settings
from app.db.client import get_db
from app.repositories.mongo_repo import MongoRepository
from app.schemas.api_v1 import (
    SimulatorControlResponse,
    SimulatorStartRequest,
    SimulatorStatusResponse,
)
from app.services.simulation_engine import sim_engine
from app.websocket.manager import ws_manager

router = APIRouter(prefix="/simulator", tags=["Simulator"])


def get_repo(db: AsyncIOMotorDatabase = Depends(get_db)) -> MongoRepository:
    return MongoRepository(db)


@router.get("/status", response_model=SimulatorStatusResponse)
async def get_simulator_status():
    """Returns the current state and execution metrics of the simulation engine."""
    return sim_engine.get_status()


@router.post("/start", response_model=SimulatorControlResponse, status_code=status.HTTP_200_OK)
async def start_simulator(
    request: SimulatorStartRequest,
    repo: MongoRepository = Depends(get_repo),
):
    """Start real-time virtual IoT simulation session."""
    if sim_engine.is_running():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Simulation is already active (status={sim_engine.status}). Stop or reset it first.",
        )

    try:
        sim_id = await sim_engine.start(config=request, repo=repo)
        return SimulatorControlResponse(
            status="running",
            message=f"Simulation session {sim_id} started successfully.",
            simulation_id=sim_id,
            playback_speed=request.playback_speed,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start simulation: {str(e)}",
        )


@router.post("/pause", response_model=SimulatorControlResponse)
async def pause_simulator():
    """Pause an active simulation session."""
    if sim_engine.status != "running":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot pause simulation from status: '{sim_engine.status}'.",
        )
    await sim_engine.pause()
    return SimulatorControlResponse(
        status="paused",
        message="Simulation paused.",
        simulation_id=sim_engine.simulation_id,
    )


@router.post("/resume", response_model=SimulatorControlResponse)
async def resume_simulator():
    """Resume a paused simulation session."""
    if sim_engine.status != "paused":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot resume simulation from status: '{sim_engine.status}'.",
        )
    await sim_engine.resume()
    return SimulatorControlResponse(
        status="running",
        message="Simulation resumed.",
        simulation_id=sim_engine.simulation_id,
    )


@router.post("/stop", response_model=SimulatorControlResponse)
async def stop_simulator():
    """Stop active simulation session."""
    if not sim_engine.is_running():
        return SimulatorControlResponse(
            status="stopped",
            message="Simulator is already stopped.",
        )
    sim_id = sim_engine.simulation_id
    await sim_engine.stop()
    return SimulatorControlResponse(
        status="stopped",
        message="Simulation terminated.",
        simulation_id=sim_id,
    )


@router.post("/reset", response_model=SimulatorControlResponse)
async def reset_simulator():
    """Completely resets simulator session and metrics."""
    await sim_engine.reset()
    return SimulatorControlResponse(
        status="stopped",
        message="Simulation reset to clean initial state.",
    )


@router.websocket("/ws/telemetry")
async def websocket_telemetry_endpoint(
    websocket: WebSocket,
    token: str = Query(None, description="API Key or bearer token"),
):
    """Authenticated WebSocket endpoint for high-frequency telemetry, anomaly alerts, and heartbeats."""
    settings = get_settings()
    # Validate token or header if provided
    client_api_key = token or websocket.headers.get("X-API-Key")
    if client_api_key != settings.API_KEY:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await ws_manager.connect(websocket)
    try:
        # Keep connection open and receive optional client messages (e.g. ping/pong)
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text('{"event_type": "pong"}')
    except WebSocketDisconnect:
        await ws_manager.disconnect(websocket)
    except Exception:
        await ws_manager.disconnect(websocket)
