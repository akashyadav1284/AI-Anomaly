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

// --- 2. Protocol Selection ---
// Set to true to stream over WebSockets (ideal for ultra-smooth 3D MPU6050 tracking at 20-50 Hz)
// Set to false to use standard HTTP POST (1-2 Hz)
#define USE_WEBSOCKET   true

// --- 3. WebSocket Configuration ---
// For Local Development (PC running FastAPI backend):
#define WS_HOST         "192.168.1.100"    // IP of your computer running the FastAPI backend
#define WS_PORT         8000               // Default FastAPI port
#define WS_PATH         "/api/v1/sensors/ws/ingest?token=iot-secret-api-key-2026"
#define WS_USE_SSL      false              // Set to true if connecting to wss://

// For Cloud Render Deployment (Uncomment when deploying to cloud):
// #define WS_HOST      "ai-anomaly.onrender.com"
// #define WS_PORT      443
// #define WS_PATH      "/api/v1/sensors/ws/ingest?token=iot-secret-api-key-2026"
// #define WS_USE_SSL   true

// --- 4. HTTP Backend Server Configuration (Fallback) ---
#define BACKEND_URL     "http://192.168.1.100:8000/api/v1/sensors/telemetry"

// --- 5. Security & Authentication ---
#define DEVICE_API_KEY  "iot-secret-api-key-2026"
#define DEVICE_ID       "ESP32_PHYSICAL_01"

// --- 6. Hardware Pinout Configuration ---
#define DHT_PIN         4         // GPIO4 connected to DHT22 DATA pin
#define DHT_TYPE        DHT22     // Sensor type DHT22 (AM2302)

#define I2C_SDA_PIN     21        // ESP32 default I2C SDA (Connected to MPU6050 & OLED)
#define I2C_SCL_PIN     22        // ESP32 default I2C SCL (Connected to MPU6050 & OLED)

#define OLED_RESET      -1        // Reset pin # (or -1 if sharing Arduino reset pin)
#define SCREEN_WIDTH    128       // OLED display width in pixels
#define SCREEN_HEIGHT   64        // OLED display height in pixels
#define OLED_I2C_ADDR   0x3C      // Typically 0x3C or 0x3D for SSD1306

// --- 7. Telemetry & Sampling Intervals ---
// When USE_WEBSOCKET is true, 50-100 ms gives smooth 10-20 Hz 3D orientation updates
#define WS_TELEMETRY_INTERVAL_MS 50     // 20 Hz streaming for MPU6050
#define HTTP_TELEMETRY_INTERVAL_MS 1000 // 1 Hz for HTTP POST
#define OLED_REFRESH_INTERVAL_MS 250    // Refresh OLED animation every 250 ms
#define MAX_HTTP_TIMEOUT_MS      5000   // 5 second HTTP network timeout

#endif // CONFIG_H
