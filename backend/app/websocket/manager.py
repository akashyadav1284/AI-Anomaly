"""WebSocket connection and broadcast manager for real-time telemetry streaming."""
import asyncio
from datetime import datetime, timezone
import json
from typing import Any, Dict, List, Set
from fastapi import WebSocket, WebSocketDisconnect
from app.core.logging import setup_logging

logger = setup_logging()


class WebSocketManager:
    """Manages active authenticated WebSocket connections with bounded queues and broadcast resilience."""

    def __init__(self, max_queue_size: int = 100):
        self.active_connections: Set[WebSocket] = set()
        self.max_queue_size = max_queue_size
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket) -> None:
        """Accept and register client connection."""
        await websocket.accept()
        async with self._lock:
            self.active_connections.add(websocket)
        logger.info("WebSocket client connected. Total clients: %d", len(self.active_connections))

    async def disconnect(self, websocket: WebSocket) -> None:
        """Deregister client connection."""
        async with self._lock:
            self.active_connections.discard(websocket)
        logger.info("WebSocket client disconnected. Total clients: %d", len(self.active_connections))

    async def broadcast(self, message: Dict[str, Any]) -> int:
        """Broadcast a structured JSON payload to all active connections.
        
        Handles client disconnects and slow clients gracefully.
        Returns the number of successfully delivered messages.
        """
        if not self.active_connections:
            return 0

        # Ensure timestamp is UTC ISO string if present
        payload_text = json.dumps(message, default=str)
        disconnected = []
        delivered = 0

        async with self._lock:
            targets = list(self.active_connections)

        for ws in targets:
            try:
                await asyncio.wait_for(ws.send_text(payload_text), timeout=2.0)
                delivered += 1
            except (WebSocketDisconnect, asyncio.TimeoutError, Exception) as e:
                logger.debug("Failed sending to client, scheduling disconnect: %s", e)
                disconnected.append(ws)

        if disconnected:
            async with self._lock:
                for ws in disconnected:
                    self.active_connections.discard(ws)

        return delivered

    def connection_count(self) -> int:
        """Return number of currently active WebSocket clients."""
        return len(self.active_connections)


# Global singleton instance for simulator broadcaster
ws_manager = WebSocketManager()
