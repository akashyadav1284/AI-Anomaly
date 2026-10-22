# Production Deployment Guide: AI-Based IoT Sensor Anomaly Detection

This document provides production deployment procedures for the software-only **AI-Based IoT Sensor Anomaly Detection** platform.

---

## 1. Production Architecture Overview

```
 [ Client Browser ]
        |
        | HTTPS / WSS
        v
 [ Nginx Reverse Proxy / Cloudflare ]
        |
        +---> /               --> Static Frontend (Vite Single Page App)
        +---> /api/v1         --> FastAPI Application Core (Uvicorn Workers)
        +---> /api/v1/ws/...  --> Asynchronous WebSocket Feeds
                   |
                   v
         [ MongoDB Atlas / Replica Set ]
         (sensor_readings, anomalies, datasets, models, experiments)
```

---

## 2. Environment Variables & Secrets Separation

### Production Backend Environment (`backend/.env.production`)
```env
# Application Settings
APP_NAME="AI-Based IoT Sensor Anomaly Detection"
APP_VERSION="1.0.0"
APP_ENV="production"
LOG_LEVEL="INFO"
API_HOST="0.0.0.0"
API_PORT=8000

# CORS (Restrict to exact production domains)
CORS_ORIGINS="https://iot-analytics.example.com"

# Managed MongoDB Atlas Connection
MONGODB_URI="mongodb+srv://<username>:<password>@cluster0.example.mongodb.net/?retryWrites=true&w=majority"
DATABASE_NAME="iot_anomaly_detection_prod"
MONGODB_MAX_POOL_SIZE=100
MONGODB_MIN_POOL_SIZE=20
MONGODB_TIMEOUT_MS=5000

# Security Keys (Generate strong 256-bit keys)
API_KEY="<generate-random-64-char-hex-secret>"
JWT_SECRET_KEY="<generate-random-64-char-hex-secret>"
JWT_ALGORITHM="HS256"

# Model Artifacts & File Storage
ARTIFACTS_DIR="/app/artifacts/models"
UPLOAD_DIR="/app/uploads/datasets"
MAX_UPLOAD_SIZE_BYTES=15728640
```

### Production Frontend Environment (`frontend/.env.production`)
```env
VITE_API_BASE_URL="https://api.iot-analytics.example.com/api/v1"
VITE_API_KEY="<matches-backend-api-key>"
```

---

## 3. Containerized Deployment via Docker Compose

### Prerequisites
- Docker Engine 24.0+ and Docker Compose v2.20+
- At least 4 GB RAM and 2 CPU cores

### Deployment Steps
```bash
# 1. Clone repository
git clone https://github.com/example/iot-anomaly-detection.git
cd iot-anomaly-detection

# 2. Configure production secrets
cp .env.example .env
# Edit .env with your production database credentials and strong API_KEY

# 3. Build production images and start services
docker compose -f docker-compose.yml up -d --build

# 4. Verify service health
docker compose ps
docker compose logs -f backend
```

---

## 4. Cloud Platform Deployments

### Option A: MongoDB Atlas (Managed Database)
1. Log into [MongoDB Cloud](https://cloud.mongodb.com).
2. Provision a M10+ dedicated cluster with TLS 1.3 enabled.
3. Configure Network Access: whitelist only the IP addresses of your backend containers or configure AWS VPC peering.
4. Create a database user with readWrite privileges on `iot_anomaly_detection_prod`.
5. Update `MONGODB_URI` in your backend deployment configuration.

### Option B: Backend Deployment (AWS ECS / Render / Fly.io / GCP Cloud Run)
1. Build and push the Docker image:
   ```bash
   docker build -t <registry>/iot-backend:1.0.0 -f Dockerfile.backend .
   docker push <registry>/iot-backend:1.0.0
   ```
2. Configure container healthcheck:
   - Target: `HTTP GET /api/v1/health`
   - Readiness probe: `HTTP GET /api/v1/ready`
3. Provision persistent volumes for `/app/artifacts` and `/app/uploads`.

### Option C: Frontend Deployment (Cloudflare Pages / Vercel / AWS S3 + CloudFront)
1. Build the production assets:
   ```bash
   cd frontend
   npm install
   npm run build
   ```
2. Deploy the generated `dist/` directory as a Single Page Application with rewrite rules routing `/*` to `/index.html`.

---

## 5. Security & Ingress Configuration
- Enforce TLS 1.3 and HSTS on all ingress endpoints.
- Rate limits are active by default (`RateLimitMiddleware`: 200 req/min per IP).
- Never commit `.env` or production credentials into source control.
