#ifndef CONFIG_H
#define CONFIG_H

// =========================================================================
// IoT Anomaly Guard - ESP32 Physical Telemetry Node Configuration
// =========================================================================
// Rename this file to `config.h` and fill in your actual credentials.
// NEVER commit your real `config.h` with Wi-Fi credentials or production keys.
// =========================================================================

// --- 1. Wi-Fi Configuration (Uses ESP32's Built-in Wi-Fi) ---
#define WIFI_SSID       "YOUR_WIFI_SSID"
#define WIFI_PASSWORD   "YOUR_WIFI_PASSWORD"

// --- 2. Local Wi-Fi WebSocket Server (Direct Website Pairing) ---
// ESP32 hosts a WebSocket server on this port so the React website connects directly
#define LOCAL_WS_PORT   81

// --- 3. Optional Cloud Ingestion Client (FastAPI / Render) ---
#define ENABLE_CLOUD_INGEST false
#define CLOUD_WS_HOST       "ai-anomaly.onrender.com"
#define CLOUD_WS_PORT       443
#define CLOUD_WS_PATH       "/api/v1/sensors/ws/ingest?token=iot-secret-api-key-2026"
#define CLOUD_WS_USE_SSL    true

// --- 4. Hardware Pinout Configuration ---
#define DHT_PIN         4         // GPIO4 connected to DHT22 DATA pin
#define DHT_TYPE        DHT22     // Sensor type DHT22 (AM2302)

#define I2C_SDA_PIN     21        // ESP32 default I2C SDA (Connected to MPU6050 & OLED)
#define I2C_SCL_PIN     22        // ESP32 default I2C SCL (Connected to MPU6050 & OLED)

#define OLED_RESET      -1        // Reset pin # (or -1 if sharing Arduino reset pin)
#define SCREEN_WIDTH    128       // OLED display width in pixels
#define SCREEN_HEIGHT   64        // OLED display height in pixels
#define OLED_I2C_ADDR   0x3C      // Typically 0x3C or 0x3D for SSD1306

// --- 5. Device Identification & Interval ---
#define DEVICE_ID       "ESP32_PHYSICAL_01"
#define WS_STREAM_INTERVAL_MS   50     // 20 Hz streaming for MPU6050 3D tracking
#define OLED_REFRESH_INTERVAL_MS 250    // 4 Hz refresh for OLED display

#endif // CONFIG_H
