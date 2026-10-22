# Architecture Specification: AI-Based IoT Sensor Anomaly Detection

## 1. Executive Summary & Purpose
The **AI-Based IoT Sensor Anomaly Detection** platform is a software-only, research-oriented monorepo engineered to ingest, process, detect, and explain anomalies across multi-variate streaming IoT sensor telemetry. The architecture is designed without dependence on physical hardware, utilizing synthetic telemetry generators, reproducible statistical noise models, and public benchmark datasets (such as NASA turbofan / SKAB).

The primary system goals are:
- **Reproducible ML Experimentation:** Decoupled pipelines for data generation, feature engineering, offline model training, evaluation, and explainability.
- **Robust Real-Time Serving:** High-throughput, asynchronous FastAPI backend exposing RESTful configuration endpoints, health/readiness probes, and WebSocket event feeds.
- **Modern Analytical Dashboard:** React 18, TypeScript, and Vite single-page application built on shadcn/ui-compatible components, Tailwind CSS, Lucide icons, and Recharts.
- **Clear Security & Decoupled Configuration:** Strict isolation between client and server environment parameters, preventing credential leakage while enabling zero-rebuild runtime adaptation.

---

## 2. Major Architectural Layers

```
+--------------------------------------------------------------------------+
|                        Frontend Single Page App                          |
|         (React 18 + TypeScript + Vite + Tailwind CSS + Recharts)         |
+------------------------------------+-------------------------------------+
                                     |
                                     | HTTP REST / WebSocket (Phase 6)
                                     v
+--------------------------------------------------------------------------+
|                         FastAPI Application Core                         |
|   (app/main.py, app/api/v1, Pydantic v2 schemas, Structured Logging)     |
+-------------------+-----------------------------------+------------------+
                    |                                   |
         Inference Calls / Models              Data Persistence
                    v                                   v
+--------------------------------------+   +-------------------------------+
|         ML Research Engine           |   |       Document Database       |
|    - Synthetic Telemetry Generators  |   |           (MongoDB)           |
|    - Feature Engineering Pipelines   |   |     (Reserved for Phase 4)    |
|    - Statistical & Deep Models       |   +-------------------------------+
|    - SHAP / Explainability Engines   |
+--------------------------------------+
```

### 2.1 Frontend Presentation Layer (`frontend/`)
- **Technology:** React 18, TypeScript (Strict Mode), Vite, Tailwind CSS, Lucide React, Recharts.
- **Role:** Presents service operational states, telemetry visualizations, threshold tuning controls, anomaly alerts, and SHAP explainability plots.
- **Architecture:** Component hierarchy separated into atomic UI primitives (`src/components/ui/`), compositional layout structures (`src/components/layout/`), data services (`src/services/`), and typed contracts (`src/types/`).
- **Network Boundary:** Connects solely via `VITE_API_BASE_URL` to the backend. Does not access databases or private cloud keys directly.

### 2.2 Backend Application Core (`backend/app/`)
- **Technology:** Python 3.11+, FastAPI, Pydantic v2, Uvicorn, pytest-asyncio.
- **Role:** Handles HTTP request routing, CORS headers, client payload validation, dependency health monitoring, model inference orchestration, and WebSocket telemetry broadcasting.
- **Modularity:** 
  - `api/v1/`: Versioned route definitions (`health.py`, and future endpoints for sensor registration, batch prediction, telemetry streams).
  - `core/`: Environment settings (`config.py`), structured logging (`logging.py`), and authentication/security middleware.
  - `schemas/`: Pydantic models enforcing input validation and output schemas.
  - `services/`: Business logic decoupling routers from model execution.
  - `repositories/`: Data access abstraction (prepared for MongoDB driver integration).
  - `websocket/`: Real-time streaming connection handlers.

### 2.3 Machine Learning Research Subsystem (`ml/`)
- **Technology:** Python, NumPy, pandas, scikit-learn, PyTorch.
- **Role:** Standalone research and pipeline workspace maintaining:
  - `data/`: Dataset loaders, synthetic generators, scaling/imputation preprocessors, and data validation rules.
  - `features/`: Multi-variate rolling window calculators, Fourier/wavelet transformations, and lag features.
  - `models/`: Model definitions (statistical baselines, Isolation Forests, Autoencoders, LSTMs).
  - `training/`: Training routines and cross-validation workflows.
  - `evaluation/`: Precision, recall, F1-score, ROC-AUC, and latency benchmarking.
  - `explainability/`: Feature attribution techniques (SHAP, PCA projection, reconstruction error maps).
  - `pipelines/`: End-to-end serialized inference pipelines exported to `artifacts/`.

### 2.4 Experimentation & Reporting (`experiments/`)
- **Structure:**
  - `configs/`: YAML/JSON parameter files governing training hyper-parameters and sensor simulation profiles.
  - `notebooks/`: Exploratory data analysis, diagnostic plots, and baseline proof-of-concepts.
  - `reports/`: Markdown and serialized evaluation summaries tracking benchmark metrics across runs.

---

## 3. Data & Inference Flow

```
Synthetic / Benchmark Datasets
               │
               ▼
   [ ml/data/loaders & generators ]
               │
               ▼
   [ ml/features & preprocessing ]
               │
               ▼
   [ ml/training & evaluation ] ──► Model Artifacts (.pkl / .pt in artifacts/)
                                                    │
                                                    ▼
             [ FastAPI ML Service (backend/app/services/) ]
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
   REST Inference Endpoints               WebSocket Telemetry Feed
   (GET/POST /api/v1/predict)             (ws://.../ws/telemetry)
            │                                     │
            └──────────────────┬──────────────────┘
                               ▼
               [ React Dashboard & Recharts UI ]
```

1. **Ingestion & Simulation:** Sensor data streams from either reproducible synthetic noise/drift generators or public benchmark datasets.
2. **Preprocessing:** Signals undergo outlier clipping, sliding-window normalization, and frequency-domain feature extraction.
3. **Inference Execution:** The backend loads compiled model weights from `artifacts/` into an inference cache. Each sensor reading or window is scored for anomaly probability.
4. **Broadcast & Presentation:** Stream updates and anomaly flags are pushed to connected React clients via WebSockets, with historical event logs stored in MongoDB.

---

## 4. API & WebSocket Architecture

### Implemented REST Endpoints (Phase 4, 5, 7 & 8)
- `GET /api/v1/health`: Liveness probe verifying the FastAPI worker process is alive.
- `GET /api/v1/ready`: Readiness probe verifying real MongoDB connectivity and connection pooling.
- `GET /api/v1/datasets`: List ingested public and synthetic datasets.
- `GET /api/v1/datasets/{name}`: Get detailed dataset metadata, features, and split sizes.
- `GET /api/v1/datasets/{name}/audit`: Run and inspect continuous data quality audits.
- `POST /api/v1/datasets/import`: Import synthetic or external time-series files with path traversal checks.
- `GET /api/v1/sensors`: Query catalog of active simulated and ingested sensor devices.
- `GET /api/v1/sensors/{device_id}/readings`: Paginated query for historical sensor readings.
- `POST /api/v1/predictions`: Execute real model inference on sensor readings with feature attribution explanations.
- `GET /api/v1/anomalies`: List historical anomalies with severity, device, and review status filters.
- `GET /api/v1/anomalies/{anomaly_id}`: Retrieve a single anomaly event record.
- `PATCH /api/v1/anomalies/{anomaly_id}/status`: Transition anomaly review status (`under_review`, `confirmed`, `false_positive`).
- `GET /api/v1/models`: List available trained model artifacts and performance metadata.
- `GET /api/v1/models/{model_name}`: Inspect model configuration, calibrated threshold, and training schema.
- `POST /api/v1/models/train`: Trigger asynchronous background model training (protected by `X-API-Key`).
- `GET /api/v1/experiments`: List model training experiments with historical metrics and parameters.
- `POST /api/v1/experiments`: Create and run real model experiment on holdout data.
- `GET /api/v1/experiments/benchmark`: Run multi-algorithm benchmark evaluation across the model suite.
- `GET /api/v1/experiments/robustness/noise`: Run noise sensitivity perturbation sweep.
- `GET /api/v1/experiments/export/csv`: Export experiment records as CSV.
- `GET /api/v1/experiments/export/json`: Export experiment records as JSON.
- `GET /api/v1/simulator/status`: Query active simulation status, devices, and throughput/latency metrics.
- `POST /api/v1/simulator/start`: Start real-time simulation session with anomaly injections and models.
- `POST /api/v1/simulator/pause`: Pause active simulation loop without session termination.
- `POST /api/v1/simulator/resume`: Resume paused simulation loop.
- `POST /api/v1/simulator/stop`: Gracefully terminate simulation session and cancel loop task.
- `POST /api/v1/simulator/reset`: Completely reset simulation state and clear metrics.

### Implemented WebSocket Endpoints (Phase 5 & 8)
- `WS /api/v1/simulator/ws/telemetry`: Authenticated high-frequency WebSocket stream broadcasting live telemetry readings, real model inferences, anomaly alerts, device states, and heartbeats. Requires valid `token` query or header.

---

## 5. Artifact & Dataset Storage Strategy
- **Raw & Processed Datasets:** Stored under `ml/data/raw/` and `ml/data/processed/`. Excluded from Git via `.gitignore`.
- **Trained Weights & Checkpoints:** Exported to `artifacts/models/` and `artifacts/checkpoints/` with version identifiers.
- **Reproducibility:** Training scripts record configuration hashes, random seeds, and dependency lockfiles alongside trained artifacts.

---

## 6. Security Boundaries & Configuration
- **Zero Secret Frontend:** The Vite build only bundles variables prefixed with `VITE_`. No database connection strings, tokens, or encryption keys are accessible to the browser.
- **CORS Protection:** Configurable via backend `CORS_ORIGINS` environment variable, restricting cross-origin requests to authorized origins.
- **Input Validation:** Strict Pydantic v2 schemas reject malformed telemetry and unwhitelisted parameters with standard 422 HTTP responses.

---

## 7. Testing & Quality Strategy
- **Backend:** `pytest` and `pytest-asyncio` with `httpx` ASGI transports verifying endpoint responses, validation constraints, and service logic. Target coverage > 85%.
- **Frontend:** `Vitest` with `React Testing Library` and `jest-dom` validating UI rendering, state transitions, and error states.
- **Static Analysis:** Strict TypeScript checking (`tsc -b`), ESLint flat configuration for React/TypeScript, and `ruff` for Python linting and code style.
