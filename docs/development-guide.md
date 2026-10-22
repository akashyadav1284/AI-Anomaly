# Developer & Operations Guide

This guide provides instructions for setting up, developing, testing, and troubleshooting the **AI-Based IoT Sensor Anomaly Detection** monorepo on Windows PowerShell and POSIX terminals.

---

## 1. Prerequisites

- **Python:** 3.11 or newer (Python 3.13 verified)
- **Node.js:** v20.x or v24.x (v24.11 verified)
- **npm:** v10.x or newer (v11.6 verified)
- **Git:** 2.x+
- **Docker & Docker Compose:** (Optional for local development; required for containerized deployment)

---

## 2. Environment Configuration

1. Copy the example configuration to `.env` in the repository root:
   ```powershell
   Copy-Item .env.example .env
   ```

2. Configuration variables:
   | Variable | Default Value | Description |
   |---|---|---|
   | `APP_ENV` | `development` | Runtime environment (`development`, `staging`, `production`) |
   | `LOG_LEVEL` | `INFO` | Console logging level |
   | `API_HOST` | `0.0.0.0` | Bind host for FastAPI server |
   | `API_PORT` | `8000` | Bind port for FastAPI server |
   | `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Allowed browser origins |
   | `VITE_API_BASE_URL`| `http://localhost:8000/api/v1` | Backend API base URL consumed by Vite |
   | `MONGODB_URI` | `mongodb://localhost:27017` | Reserved for Phase 4 database integration |
   | `DATABASE_NAME` | `iot_anomaly_detection` | Reserved for Phase 4 database name |

---

## 3. Backend Development Workflow

### 3.1 Virtual Environment Setup & Installation
```powershell
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv .venv

# Activate virtual environment (PowerShell)
.\.venv\Scripts\Activate.ps1

# Upgrade pip & install dependencies in editable mode
python -m pip install --upgrade pip
pip install -e ".[dev]"
```

### 3.2 Starting the FastAPI Server
```powershell
# Run backend with auto-reload
.\.venv\Scripts\uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
- Interactive Swagger Documentation: [http://localhost:8000/docs](http://localhost:8000/docs)
- Interactive ReDoc: [http://localhost:8000/redoc](http://localhost:8000/redoc)
- Health check: [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health)
- Readiness check: [http://localhost:8000/api/v1/ready](http://localhost:8000/api/v1/ready)

### 3.3 Backend Verification & Testing
```powershell
# Run pytest test suite
.\.venv\Scripts\pytest -v

# Run Python linter & code checks
.\.venv\Scripts\ruff check .
```

---

## 4. Frontend Development Workflow

### 4.1 Dependency Installation
```powershell
# Navigate to frontend directory
cd frontend

# Install npm packages
npm install
```

### 4.2 Starting the Vite Development Server
```powershell
npm run dev
```
- Access application in browser: [http://localhost:5173](http://localhost:5173)

### 4.3 Frontend Verification & Testing
```powershell
# Run ESLint
npm run lint

# Run Vitest test suite
npm test

# Run TypeScript type check
npx tsc -b

# Create production build
npm run build
```

---

## 5. Docker Workflow (Containerized Execution)

If Docker Desktop is running on your machine:

```powershell
# Validate compose configuration
docker compose config

# Build and start all services (Backend, Frontend, MongoDB) in background
docker compose up -d --build

# View container logs
docker compose logs -f

# Shut down containers and remove networks
docker compose down
```

> **Note on Docker in Local Windows Environments:** If Docker Desktop is not running, the system will output a connection error (`cannot find file npipe://...`). Docker is **not mandatory** for development; native Python and Node.js commands run without any container dependencies.

---

## 6. Troubleshooting Common Issues

### Backend: ModuleNotFoundError
Ensure you installed the package in editable mode (`pip install -e .`) inside the activated virtual environment, or set `PYTHONPATH=.`.

### Frontend: Port 5173 Already in Use
Vite will automatically fall back to port 5174. If needed, specify an explicit port: `npm run dev -- --port 3000`.

### Backend: CORS Rejected on Browser Fetch
Verify that the `CORS_ORIGINS` setting in `.env` includes the exact URL and port where your Vite client is hosted (e.g., `http://localhost:5173`).
