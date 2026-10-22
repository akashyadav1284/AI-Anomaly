# Production Readiness & Go-Live Checklist

Use this checklist before releasing or deploying new versions of the **AI-Based IoT Sensor Anomaly Detection** platform.

---

## 1. Security & Secrets Management
- [x] **No Hardcoded Secrets:** Codebase scanned; all secrets and tokens loaded through `pydantic-settings` environment variables.
- [x] **Strict CORS Allowed Origins:** Wildcards (`*`) removed; restricted to explicitly configured frontend domains.
- [x] **API Key Protected Sensitive Routes:** Retraining (`POST /api/v1/models/train`) and dataset imports require valid `X-API-Key`.
- [x] **WebSocket Authentication:** Live streaming endpoint verifies access token query parameter before accepting WebSocket connections.
- [x] **Path Traversal Protection:** Dataset import endpoints enforce canonical path resolution within approved root directories.
- [x] **Security Response Headers:** `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Strict-Transport-Security`, and `Referrer-Policy` enabled via middleware.
- [x] **Sliding-Window Rate Limiting:** In-memory rate limiting rejects abuse with `HTTP 429 Too Many Requests`.

---

## 2. Machine Learning & Research Integrity
- [x] **Chronological Partitions:** Training, validation, and holdout test partitions maintain strict causal ordering without lookahead leakage.
- [x] **No Test-Set Threshold Tuning:** Calibrated decision boundaries fitted strictly on training/validation partitions.
- [x] **Out-of-Sample Predictions:** LOF novelty detection and Isolation Forest execute genuine inference without hardcoded scoring.
- [x] **Deterministic Telemetry:** Simulation engines and synthetic generators utilize explicit seeds (`random_state=42`).
- [x] **Explainability vs. Causality:** User interface discloses that feature attributions represent statistical deviation rather than physical causation.

---

## 3. Reliability & Fault Tolerance
- [x] **Database Outage Graceful Degradation:** `/ready` probe accurately returns `503 Service Unavailable` if MongoDB disconnects, while the FastAPI process `/health` remains `200 OK`.
- [x] **Bounded Telemetry Buffers:** Ring buffers in memory prevent memory leaks during long-running simulation sessions.
- [x] **Simulation State Locking:** Duplicate simulation start calls return `409 Conflict`.
- [x] **WebSocket Reconnect Handling:** Client automatically attempts exponential/periodic reconnects upon connection drop.
- [x] **Non-Blocking Background Workers:** Model training jobs execute in a thread pool executor, maintaining high HTTP API responsiveness.

---

## 4. Verification & Static Analysis
- [x] **Backend Test Suite:** All 34 pytest unit and integration test cases pass (100% success rate).
- [x] **Frontend Static Analysis:** TypeScript strict mode compilation (`tsc -b`) succeeds with 0 errors.
- [x] **Frontend Linting:** ESLint succeeds with 0 errors.
- [x] **Production Bundle:** Vite production asset build produces minified CSS and JS bundles.
