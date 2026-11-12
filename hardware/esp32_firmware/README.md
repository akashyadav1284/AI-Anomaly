# ESP32 Physical Hardware Firmware — IoT Anomaly Guard

This directory contains the production-grade Arduino C++ firmware for the **ESP32 DevKit** physical sensor node, integrating:
- **DHT22 (AM2302):** Calibrated digital temperature (°C) & relative humidity (%).
- **MPU6050:** 6-axis I2C Inertial Measurement Unit (IMU) with 3-axis accelerometer and 3-axis gyroscope, producing real-time vector acceleration magnitude ($\text{m/s}^2$) and vibration Root Mean Square (RMS).
- **SSD1306 128x64 OLED:** I2C display rendering real-time metrics, network state, sequence IDs, and backend transmission codes.

---

## 1. Hardware Pinout & Wiring Diagram

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

## 2. Required Arduino Libraries

Install the following libraries via the Arduino IDE Library Manager (`Ctrl + Shift + I` / `Cmd + Shift + I`) or PlatformIO:

1. **Adafruit SSD1306** (by Adafruit) — version 2.5.9+
2. **Adafruit GFX Library** (by Adafruit) — version 1.11.9+
3. **Adafruit MPU6050** (by Adafruit) — version 2.2.6+
4. **Adafruit Unified Sensor** (by Adafruit) — version 1.1.14+
5. **DHT sensor library** (by Adafruit) — version 1.4.6+

---

## 3. Configuration & Flashing Instructions

1. Copy `config.example.h` to `config.h`:
   ```bash
   cp config.example.h config.h
   ```
2. Open `config.h` and configure:
   - `WIFI_SSID`: Your Wi-Fi network name.
   - `WIFI_PASSWORD`: Your Wi-Fi network password.
   - `BACKEND_URL`:
     - For production: `"https://ai-anomaly.onrender.com/api/v1/sensors/telemetry"`
     - For local development: `"http://<YOUR_COMPUTER_LOCAL_IP>:8000/api/v1/sensors/telemetry"`
   - `DEVICE_API_KEY`: Authentication secret matching `API_KEY` in the FastAPI backend.
   - `DEVICE_ID`: Unique node identifier (e.g., `"ESP32_PHYSICAL_01"`).
3. Connect the ESP32 to your computer via micro-USB.
4. In the Arduino IDE:
   - Select Board: **ESP32 Dev Module**
   - Select Port: Your ESP32 COM port (e.g., `COM3`, `COM4`, `/dev/ttyUSB0`)
   - Click **Upload** (`Ctrl + U`).
5. Open Serial Monitor at **115200 baud** to view real-time transmission logs.

---

## 4. Telemetry Format Transmitted

The firmware dispatches HTTP POST requests with headers:
```http
Content-Type: application/json
X-API-Key: iot-secret-api-key-2026
```

Payload structure:
```json
{
  "device_id": "ESP32_PHYSICAL_01",
  "source": "physical",
  "sequence": 1042,
  "sensors": {
    "temperature": 28.4,
    "humidity": 62.1,
    "accel_x": 0.124,
    "accel_y": 0.086,
    "accel_z": 9.814,
    "gyro_x": 0.002,
    "gyro_y": 0.001,
    "gyro_z": -0.004,
    "acceleration_magnitude": 9.815,
    "vibration_rms": 0.0421
  }
}
```

