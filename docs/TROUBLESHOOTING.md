# Troubleshooting & Diagnostic Guide

Common operational issues, diagnosis steps, and remediation workflows for the **AI-Based IoT Sensor Anomaly Detection** platform.

---

## 1. MongoDB Connectivity Issues

### Symptom:
`/api/v1/ready` returns `HTTP 503 Service Unavailable` with `components.database.ready: false`.

### Diagnosis:
1. Verify if MongoDB is running locally or in Docker:
   ```powershell
   # Windows PowerShell
   Test-NetConnection -ComputerName 127.0.0.1 -Port 27017
   
   # Docker
   docker ps | grep mongo
   ```
2. Check MongoDB credentials and URI in `backend/.env`.

### Remediation:
- Start local MongoDB service:
  ```powershell
  net start MongoDB
  ```
- Or start via Docker:
  ```bash
  docker compose up -d mongodb
  ```

---

## 2. WebSocket Telemetry Feed Disconnected

### Symptom:
Sidebar displays `WebSocket Feed: DISCONNECTED` and Live Monitoring shows "Waiting for incoming frames...".

### Diagnosis:
1. Verify backend server is running on `http://localhost:8000`.
2. Inspect WebSocket status code in browser developer tools (Network -> WS).
   - Code `1008 (Policy Violation)`: Missing or mismatched `token` query parameter. Verify `VITE_API_KEY` matches backend `API_KEY`.
3. Check browser console for CORS or WebSocket connection refused errors.

### Remediation:
- Restart backend with matching `API_KEY` in environment.
- In the dashboard, click **"Reconnect WebSocket"** on the Live Monitoring page.

---

## 3. Simulator Session Conflicts

### Symptom:
Clicking **Start Simulation** returns `HTTP 409 Conflict: Simulation is already active`.

### Diagnosis:
Another simulation loop is actively running or in a paused state.

### Remediation:
- Click **"Terminate Session"** or **"Reset"** (circular arrow button) on the Live Monitoring or Simulation Control Center page.
- Or call the reset endpoint via CLI:
  ```bash
  curl -X POST http://localhost:8000/api/v1/simulator/reset
  ```

---

## 4. Model Artifact Not Found

### Symptom:
`ModelRegistryService: Model 'isolation_forest' artifact not found in artifacts/models`.

### Diagnosis:
Check whether the `artifacts/models/isolation_forest` directory contains `model.joblib`, `pipeline.joblib`, and `metadata.json`.

### Remediation:
Retrain the baseline artifact via CLI:
```powershell
.\backend\.venv\Scripts\python -c "from ml.training.trainer import ModelTrainer; from ml.data.generators.sensor_generator import IoTSensorGenerator; gen = IoTSensorGenerator(); df = gen.generate(n_rows=1000); trainer = ModelTrainer(); trainer.train(df=df, model_name='isolation_forest', output_dir='artifacts/models/isolation_forest')"
```

---

## 5. Rate Limiting (HTTP 429)

### Symptom:
API responses return `HTTP 429 Too Many Requests`.

### Diagnosis:
Client IP has exceeded the 200 requests/minute threshold.

### Remediation:
- Inspect request header `Retry-After`.
- For automated testing or high-frequency benchmarks, increase `max_requests` in `backend/app/main.py`.
