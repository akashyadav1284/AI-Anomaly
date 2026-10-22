# AI-Based IoT Sensor Anomaly Detection

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.3+-61DAFB.svg?logo=react&logoColor=black)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6+-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4+-646CFF.svg?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Docker](https://img.shields.io/badge/Docker-Enabled-2496ED.svg?logo=docker&logoColor=white)](https://www.docker.com/)

A research-oriented, software-only platform designed for multi-sensor IoT telemetry anomaly detection, explainability, and real-time visualization.

---

## Current Status: Phase 10 Completed (Production Deployment & Final Verification)

The **AI-Based IoT Sensor Anomaly Detection** platform has achieved full production readiness across all 10 planned phases:
- **Phase 1:** Clean monorepo foundation, typed interfaces, and architectural blueprints.
- **Phase 2:** Multivariate synthetic IoT telemetry generators and benchmark loaders (NASA, NAB).
- **Phase 3:** Standardized ML research engine with 6 models, causal preprocessing, and threshold calibration.
- **Phase 4:** Asynchronous FastAPI backend, MongoDB document persistence across 6 collections, and ML registry.
- **Phase 5:** Software-only virtual IoT simulation engine, synchronous ML inference, and WebSocket feeds.
- **Phase 6:** Premium 10-module React 18, TypeScript, Tailwind CSS, and Recharts analytics dashboard.
- **Phase 7:** Advanced research lab with multi-model benchmarks, noise sensitivity sweeps, and CSV/JSON exports.
- **Phase 8:** Security hardening (security headers, sliding-window rate limiting, path traversal protection, API keys).
- **Phase 9:** Scientific evaluation documentation, out-of-sample benchmarks, and reproducible CLI commands.
- **Phase 10:** Production containerization (Docker multi-stage builds, Compose orchestration, volume mounts), comprehensive documentation ([`docs/DEPLOYMENT.md`](file:///c:/Users/akash/OneDrive/Desktop/CSE276/docs/DEPLOYMENT.md), [`docs/PRODUCTION_CHECKLIST.md`](file:///c:/Users/akash/OneDrive/Desktop/CSE276/docs/PRODUCTION_CHECKLIST.md), [`docs/TROUBLESHOOTING.md`](file:///c:/Users/akash/OneDrive/Desktop/CSE276/docs/TROUBLESHOOTING.md), [`docs/FINAL_PROJECT_REPORT.md`](file:///c:/Users/akash/OneDrive/Desktop/CSE276/docs/FINAL_PROJECT_REPORT.md)), and 100% test verification (34 backend tests, 0 lint errors, verified production bundle).

---

## Repository Structure

```
iot-anomaly-detection/
├── frontend/                     # React + TypeScript + Vite UI
│   ├── src/
│   │   ├── components/ui/        # shadcn/ui-compatible components (Card, Badge, Button)
│   │   ├── components/layout/    # Layout components (Header)
│   │   ├── services/             # Typed API client with centralized error handling
│   │   ├── types/                # TypeScript schemas matching API responses
│   │   ├── utils/                # Tailwind clsx utility (cn)
│   │   ├── test/                 # Vitest & React Testing Library test suites
│   │   ├── App.tsx               # Phase 1 initialization page
│   │   └── main.tsx              # React application entry point
│   ├── package.json              # Frontend scripts & dependencies
│   ├── vite.config.ts            # Vite & Vitest configuration
│   └── tsconfig.json             # TypeScript strict configuration
│
├── backend/                      # FastAPI Python Service
│   ├── app/
│   │   ├── api/v1/               # Health & readiness endpoints
│   │   ├── core/                 # Config (Pydantic Settings) & structured logging
│   │   ├── schemas/              # Pydantic v2 request/response schemas
│   │   └── main.py               # FastAPI application factory and error handlers
│   ├── tests/                    # Async pytest test suite
│   └── pyproject.toml            # Python dependencies and build config
│
├── ml/                           # ML Research & Pipelines (Phases 2, 3, 5, 8)
│   ├── data/                     # Loaders, generators, preprocessing, validation
│   ├── features/                 # Time-series feature engineering
│   ├── models/                   # Statistical, classical, and deep model definitions
│   ├── training/                 # Offline training routines
│   ├── evaluation/               # Model evaluation scripts
│   ├── explainability/           # SHAP & feature attribution
│   └── pipelines/                # Serialized inference pipelines
│
├── experiments/                  # Experimentation Tracking
│   ├── configs/                  # Experiment configuration files
│   ├── notebooks/                # Exploratory Jupyter notebooks
│   └── reports/                  # Generated benchmark reports
│
├── artifacts/                    # Model weights and serialized pipelines (.gitignored)
├── docs/                         # Architecture, development, and research documentation
│   ├── architecture.md           # System design and component boundaries
│   ├── development-guide.md      # Installation, execution, and troubleshooting
│   └── research-methodology.md   # Benchmark strategy and evaluation protocols
│
├── .env.example                  # Environment configuration template
├── .gitignore                    # Comprehensive ignore rules
├── .dockerignore                 # Docker build exclusions
├── Dockerfile.frontend           # Multi-stage Nginx build for frontend
├── Dockerfile.backend            # Lightweight Python container for backend
├── docker-compose.yml            # Multi-container orchestration (Frontend, Backend, Mongo)
└── README.md
```

---

## Quickstart Guide

### 1. Environment Setup
```powershell
Copy-Item .env.example .env
```

### 2. Backend Setup & Run (Windows PowerShell)
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
.\.venv\Scripts\uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
- API Health Check: [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health)
- API Readiness Check: [http://localhost:8000/api/v1/ready](http://localhost:8000/api/v1/ready)
- Swagger Documentation: [http://localhost:8000/docs](http://localhost:8000/docs)

Run Backend Tests:
```powershell
.\.venv\Scripts\pytest -v
```

### 3. Frontend Setup & Run
```powershell
cd frontend
npm install
npm run dev
```
- Open UI: [http://localhost:5173](http://localhost:5173)

Run Frontend Verification:
```powershell
npm run lint      # Run ESLint
npm test          # Run Vitest test suite
npx tsc -b        # Run TypeScript type check
npm run build     # Test production build
```

---

## 10-Phase Roadmap

- **Phase 1: Project Foundation & Architecture** (Completed)
- **Phase 2: Dataset Ingestion & Pipeline Foundations** (Upcoming)
- **Phase 3: Baseline Statistical & Machine Learning Models** (Upcoming)
- **Phase 4: MongoDB Persistence & Schema Design** (Upcoming)
- **Phase 5: Deep Learning & Sequential Anomaly Models** (Upcoming)
- **Phase 6: Real-Time WebSocket Telemetry Simulator** (Upcoming)
- **Phase 7: Full Analytical Dashboard & Visualizations** (Upcoming)
- **Phase 8: Model Explainability (SHAP & PCA)** (Upcoming)
- **Phase 9: Automated Evaluation & Benchmarking** (Upcoming)
- **Phase 10: Production Hardening & Deployment** (Upcoming)
