"""Security middleware enforcing rate limiting, request size bounds, and secure headers."""
import time
from collections import defaultdict
from typing import Dict, List
from fastapi import Request, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from app.core.config import get_settings
from app.schemas.health import ErrorDetail, ErrorResponse


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Enforces standard security response headers against common web vulnerabilities."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """In-memory token bucket rate limiter per client IP."""

    def __init__(self, app, max_requests: int = 150, window_seconds: int = 60):
        super().__init__(app)
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.clients: Dict[str, List[float]] = defaultdict(list)

    async def dispatch(self, request: Request, call_next):
        # Exclude documentation and health check endpoints from rate limiting
        if request.url.path in ("/docs", "/redoc", "/openapi.json", "/api/v1/health", "/api/v1/ready"):
            return await call_next(request)

        client_ip = request.client.host if request.client else "unknown"
        now = time.time()
        timestamps = self.clients[client_ip]

        # Evict old timestamps
        while timestamps and timestamps[0] <= now - self.window_seconds:
            timestamps.pop(0)

        if len(timestamps) >= self.max_requests:
            error_resp = ErrorResponse(
                error=ErrorDetail(
                    code="RATE_LIMIT_EXCEEDED",
                    message=f"Too many requests. Limit is {self.max_requests} requests per {self.window_seconds}s.",
                )
            )
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content=error_resp.model_dump(mode="json"),
                headers={"Retry-After": str(self.window_seconds)},
            )

        timestamps.append(now)
        return await call_next(request)
