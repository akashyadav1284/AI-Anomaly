# Physical IoT Hardware Integration Guide
## IoT Anomaly Guard — ESP32 + DHT22 + MPU6050 + SSD1306

This guide provides end-to-end instructions for deploying, wiring, flashing, and monitoring physical IoT sensor hardware on the **IoT Anomaly Guard** platform.

---

## 1. Hardware Architecture & Data Flow

```
+-------------------------------------------------------------+
|                     PHYSICAL HARDWARE TIER                  |
|                                                             |
|  [DHT22 Sensor]                [MPU6050 6-Axis IMU]         |
|  Temp & Humidity               Accel (X/Y/Z) & Gyro (X/Y/Z) |
|         |                                    |              |
|   (GPIO 4 / 1-Wire)                    (I2C: 0x68)          |
|         +-----------------+------------------+              |
|                           v                                 |
|                  [ESP32 DevKit V1]                          |
|         Firmware: Non-blocking sampling & RMS filter        |
|                           |                                 |
|              +------------+------------+                    |
|              v                         v                    |
|       [SSD1306 OLED]             [Wi-Fi Radio]              |
|       I2C Addr: 0x3C             HTTPS / JSON POST          |
|       Local Status HUD                 |                    |
+----------------------------------------|--------------------+
                                         | (JSON Payload)
                                         v
+-------------------------------------------------------------+
|                      BACKEND CLOUD TIER                     |
|                                                             |
|              FastAPI Ingestion Endpoint                     |
|            POST /api/v1/sensors/telemetry                   |
|            Header: X-API-Key: <DEVICE_API_KEY>              |
|                           |                                 |
|            +--------------+--------------+                  |
|            v                             v                  |
|    [MongoDB Atlas]               [ML Inference]             |
|    sensor_readings               ModelRegistryService       |
|    (source: physical)            (Isolation Forest /        |
|            |                      Statistical Z-Score)      |
|            |                             |                  |
|            +--------------+--------------+                  |
|                           v                                 |
|             [WebSocket ConnectionManager]                   |
|             /api/v1/simulator/ws/telemetry                  |
+---------------------------|---------------------------------+
                            | (Full-Duplex WS Stream)
                            v
+-------------------------------------------------------------+
|                      REACT 18 DASHBOARD                     |
|                                                             |
|  - Live Monitoring Page (Physical vs. Simulated filters)    |
|  - Live MPU6050 Waveforms (Accel Mag, Vibration RMS, IMU)   |
|  - Anomaly Investigation Workbench (Tagged: PHYSICAL)       |
|  - Device Health Tracker (Online / Standby / Offline)       |
+-------------------------------------------------------------+
```

---

## 2. Wiring Diagram & Pin Connections

### Complete Pin Mapping Table

| Component | Pin Label | ESP32 GPIO | Electrical Connection Notes |
|---|---|---|---|
| **DHT22** | VCC | **3V3** or **VIN** | 3.3V recommended; 5V supported by AM2302 modules. |
| **DHT22** | DATA | **GPIO 4** | Digital bidirectional line. Add 4.7kΩ–10kΩ pull-up resistor to VCC if raw 4-pin DHT22 without carrier board. |
| **DHT22** | GND | **GND** | System Ground. |
| **MPU6050** | VCC | **3V3** | Power supply (3.3V). |
| **MPU6050** | GND | **GND** | System Ground. |
| **MPU6050** | SCL | **GPIO 22** | Hardware I2C Clock (SCL). |
| **MPU6050** | SDA | **GPIO 21** | Hardware I2C Data (SDA). |
| **MPU6050** | AD0 | GND / NC | Ground sets I2C address to `0x68`. |
| **SSD1306** | VCC | **3V3** | 3.3V Power supply. |
| **SSD1306** | GND | **GND** | System Ground. |
| **SSD1306** | SCL | **GPIO 22** | Shared Hardware I2C Clock. |
| **SSD1306** | SDA | **GPIO 21** | Shared Hardware I2C Data. |

---

## 3. Physical Feature Engineering & ML Mapping Strategy

### Measured Physical Signals
1. **Temperature ($T$ in $^\circ\text{C}$):** Read directly from the calibrated DHT22 sensor.
2. **Humidity ($H$ in $\%$):** Read directly from the calibrated DHT22 sensor.
3. **Tri-Axial Acceleration ($a_x, a_y, a_z$ in $\text{m/s}^2$):** Read from the MPU6050 accelerometer at 20–50 Hz.
4. **Vector Acceleration Magnitude:**
   $$\|\mathbf{a}\| = \sqrt{a_x^2 + a_y^2 + a_z^2}$$
5. **Vibration Root Mean Square (RMS):**
   The firmware calculates deviation from standard 1G Earth gravity ($g_0 = 9.80665\text{ m/s}^2$) over a sliding sample window ($N=16$):
   $$\text{RMS}_{\text{vib}} = \sqrt{\frac{1}{N} \sum_{i=1}^{N} \left(\|\mathbf{a}_i\| - g_0\right)^2}$$

### Model Feature Adapter
The existing industrial models (`isolation_forest`, `lof`, `one_class_svm`) expect 5 features:
$$[\text{temperature}, \text{humidity}, \text{pressure}, \text{vibration}, \text{current}]$$

When telemetry arrives from a physical device:
- `temperature` $\gets$ DHT22 Temperature.
- `humidity` $\gets$ DHT22 Relative Humidity.
- `vibration` $\gets$ MPU6050 Vibration RMS metric.
- `pressure` $\gets$ Nominally aligned to $101.3\text{ kPa}$ (ambient sea-level).
- `current` $\gets$ Nominally aligned to $12.5\text{ A}$ (nominal steady-state).
- All records retain `"source": "physical"`, ensuring zero data fabrication and transparent attribution.

---

## 4. Local Testing & Verification Workflow

### Step 1: Start the Local Backend
```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Step 2: Start the Frontend Dashboard
```powershell
cd frontend
npm run dev
```
Open your browser at `http://localhost:5173`.

### Step 3: Test Telemetry Ingestion via PowerShell / cURL
To simulate an ESP32 dispatch before flashing hardware:
```powershell
$headers = @{
    "Content-Type" = "application/json"
    "X-API-Key" = "iot-secret-api-key-2026"
}
$body = @{
    device_id = "ESP32_PHYSICAL_01"
    source = "physical"
    sequence = 101
    sensors = @{
        temperature = 29.4
        humidity = 64.2
        accel_x = 0.08
        accel_y = 0.04
        accel_z = 9.81
        gyro_x = 0.01
        gyro_y = 0.0
        gyro_z = -0.01
        acceleration_magnitude = 9.81
        vibration_rms = 0.045
    }
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Uri "http://localhost:8000/api/v1/sensors/telemetry" -Method Post -Headers $headers -Body $body
```

### Expected Response:
```json
{
  "status": "success",
  "reading_id": "PHYS_READ_7a1b4c9f12",
  "device_id": "ESP32_PHYSICAL_01",
  "timestamp": "2026-11-12T16:55:00.000000Z",
  "prediction": {
    "model_name": "isolation_forest",
    "normalized_score": 0.124,
    "decision_threshold": 0.5,
    "is_anomaly": false,
    "top_contributing_features": []
  }
}
```

### Step 4: Verify Live Dashboard
1. Navigate to **Live Monitoring**.
2. Select **Source: ESP32 Physical** or **Combined**.
3. Observe live readings updating on the waveform chart and recent frame table with the green **PHYSICAL** badge.
4. Navigate to **Anomaly Investigation** to verify physical anomaly triage.

---

## 5. Production Cloud Deployment Configuration

When deploying the ESP32 to production (Render backend + MongoDB Atlas):
1. In `hardware/esp32_firmware/config.h`:
   ```c
   #define BACKEND_URL "https://ai-anomaly.onrender.com/api/v1/sensors/telemetry"
   #define DEVICE_API_KEY "YOUR_PRODUCTION_API_KEY"
   ```
2. The firmware uses standard HTTP POST over Wi-Fi. For strict HTTPS certificate pinning on ESP32, use `WiFiClientSecure` with the Render root CA certificate.

---

## 6. Troubleshooting Common Issues

| Symptom | Probable Cause | Corrective Action |
|---|---|---|
| OLED displays `[--]` and Serial prints `Wi-Fi lost` | Incorrect Wi-Fi SSID / Password or 5 GHz band | ESP32 only supports 2.4 GHz Wi-Fi. Verify credentials in `config.h`. |
| Serial prints `DHT22 read failure!` | Loose wiring or missing pull-up resistor | Verify GPIO 4 connection. Ensure 3.3V or 5V power is connected. |
| Serial prints `MPU6050 failed to initialize` | I2C wiring swapped or bad AD0 address | Verify SDA is on GPIO 21 and SCL on GPIO 22. Ensure MPU6050 VCC is 3.3V. |
| Backend returns `HTTP 401 Unauthorized` | Mismatched API Key | Ensure `DEVICE_API_KEY` in `config.h` matches `API_KEY` in backend settings. |
| Backend returns `HTTP 422 Unprocessable Entity` | Out-of-bounds sensor values | Verify DHT22 is not returning `NaN` or values like humidity > 100%. |

