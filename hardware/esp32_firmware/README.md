# ESP32 Physical Hardware Firmware — IoT Anomaly Guard

This directory contains the production-grade Arduino C++ firmware for the **ESP32 DevKit** physical sensor node, integrating:
- **DHT22 (AM2302):** Calibrated digital temperature (°C) & relative humidity (%).
- **MPU6050:** 6-axis I2C Inertial Measurement Unit (IMU) with 3-axis accelerometer and 3-axis gyroscope, producing real-time vector acceleration magnitude ($\text{m/s}^2$) and vibration Root Mean Square (RMS).
- **SSD1306 128x64 OLED:** I2C display rendering real-time metrics, network state, sequence IDs, and protocol status (`WS_STREAM` / `HTTP_OK`).
- **Wi-Fi Connectivity:** Integrated directly into the ESP32 chip (no external Wi-Fi shield or module needed).
- **Dual Telemetry Protocols:**
  - **WebSocket Streaming (Recommended):** High-frequency (10–20 Hz) low-latency stream for ultra-smooth 3D orientation visualization and anomaly detection.
  - **HTTP POST (Fallback):** 1 Hz periodic batch updates to REST API.

---

## 1. Hardware Note on Wi-Fi

> **IMPORTANT:**
> You **do NOT need to buy or attach an external Wi-Fi module** (such as ESP8266, nRF24L01, etc.).
> The **ESP32 microcontroller has an integrated 2.4 GHz 802.11 b/g/n Wi-Fi radio and baseband** on the silicon itself.
> The firmware uses the standard ESP32 `WiFi.h` library to connect directly to your local Wi-Fi router or mobile hotspot.

---

## 2. Hardware Pinout & Wiring Diagram

| Component | Component Pin | ESP32 GPIO | Description |
|---|---|---|---|
| **DHT22** | VCC | 3.3V or 5V | Power supply (connect 10k pull-up resistor between VCC & DATA) |
| **DHT22** | DATA | **GPIO 4** | Digital bidirectional 1-wire communication |
| **DHT22** | GND | GND | Common ground |
| **MPU6050** | VCC | 3.3V | Power supply |
| **MPU6050** | GND | GND | Common ground |
| **MPU6050** | SCL | **GPIO 22** | Default Hardware I2C Clock (SCL) |
| **MPU6050** | SDA | **GPIO 21** | Default Hardware I2C Data (SDA) |
| **SSD1306 OLED** | VCC | 3.3V | Power supply |
| **SSD1306 OLED** | GND | GND | Common ground |
| **SSD1306 OLED** | SCL | **GPIO 22** | Shared Hardware I2C Clock (SCL) |
| **SSD1306 OLED** | SDA | **GPIO 21** | Shared Hardware I2C Data (SDA) |

> **Note on I2C Addressing:**
> Both the MPU6050 (default `0x68`) and the SSD1306 OLED (default `0x3C`) share the exact same I2C bus pins (`GPIO 21` and `GPIO 22`) without any bus collisions due to distinct 7-bit device addresses.

---

## 3. Required Arduino Libraries

Install the following libraries via the Arduino IDE Library Manager (`Ctrl + Shift + I` / `Cmd + Shift + I`) or PlatformIO:

1. **WebSockets** (by Markus Sattler) — version 2.4.1+ *(for real-time WebSocket streaming over Wi-Fi)*
2. **Adafruit SSD1306** (by Adafruit) — version 2.5.9+
3. **Adafruit GFX Library** (by Adafruit) — version 1.11.9+
4. **Adafruit MPU6050** (by Adafruit) — version 2.2.6+
5. **Adafruit Unified Sensor** (by Adafruit) — version 1.1.14+
6. **DHT sensor library** (by Adafruit) — version 1.4.6+

---

## 4. Configuration & Flashing Instructions

1. Copy `config.example.h` to `config.h`:
   ```bash
   cp config.example.h config.h
   ```
2. Open `config.h` and configure:
   - `WIFI_SSID`: Your Wi-Fi network name or mobile hotspot SSID.
   - `WIFI_PASSWORD`: Your Wi-Fi network password.
   - `USE_WEBSOCKET`: Set to `true` for 20 Hz low-latency streaming to the 3D dashboard.
   - `WS_HOST`: IP address of your computer running the FastAPI backend (e.g., `192.168.1.100`) or cloud domain (`ai-anomaly.onrender.com`).
   - `WS_PORT`: `8000` for local, `443` for cloud SSL.
   - `DEVICE_API_KEY`: Authentication secret matching `API_KEY` in the FastAPI backend (`iot-secret-api-key-2026`).
   - `DEVICE_ID`: Unique node identifier (e.g., `"ESP32_PHYSICAL_01"`).
3. Connect the ESP32 to your computer via micro-USB.
4. In the Arduino IDE:
   - Select Board: **ESP32 Dev Module**
   - Select Port: Your ESP32 COM port (e.g., `COM3`, `COM4`, `/dev/ttyUSB0`)
   - Click **Upload** (`Ctrl + U`).
5. Open Serial Monitor at **115200 baud** to view real-time transmission logs.

---

## 5. Telemetry Format Transmitted Over Wi-Fi

The firmware dispatches JSON frames over WebSocket (`/api/v1/sensors/ws/ingest`) or HTTP:
```json
{
  "device_id": "ESP32_PHYSICAL_01",
  "source": "physical",
  "sequence": 1042,
  "sensors": {
    "temperature": 24.8,
    "humidity": 48.2,
    "accel_x": 0.124,
    "accel_y": -0.045,
    "accel_z": 9.782,
    "gyro_x": 0.012,
    "gyro_y": -0.008,
    "gyro_z": 0.003,
    "acceleration_magnitude": 9.783,
    "vibration_rms": 0.0241
  }
}
```
All packets are received by the FastAPI backend, evaluated through the anomaly detection pipeline, stored in MongoDB Atlas, and broadcast instantaneously to the live React & 3D Three.js dashboard.
