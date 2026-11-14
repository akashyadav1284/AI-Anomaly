#ifndef CONFIG_H
#define CONFIG_H

// =========================================================================
// IoT Anomaly Guard - ESP32 Physical Telemetry Node Configuration
// =========================================================================
// Fill in your Wi-Fi credentials below.
// =========================================================================

// --- 1. Wi-Fi Configuration (Uses ESP32's Built-in Wi-Fi) ---
#define WIFI_SSID       "YOUR_WIFI_SSID"
#define WIFI_PASSWORD   "YOUR_WIFI_PASSWORD"

// --- 2. Cloud Backend Ingestion (Default & Recommended) ---
// The ESP32 sends telemetry to the cloud backend over HTTPS/HTTP.
// The backend automatically broadcasts it via Secure WebSocket (WSS)
// directly to your live website with zero browser security blocks!
#define BACKEND_URL     "https://ai-anomaly.onrender.com/api/v1/sensors/telemetry"
#define DEVICE_API_KEY  "iot-secret-api-key-2026"
#define DEVICE_ID       "ESP32_PHYSICAL_01"

// --- 3. Hardware Pinout Configuration ---
#define DHT_PIN         4         // GPIO4 connected to DHT22 DATA pin
#define DHT_TYPE        DHT22     // Sensor type DHT22 (AM2302)

#define I2C_SDA_PIN     21        // ESP32 default I2C SDA (Connected to MPU6050 & OLED)
#define I2C_SCL_PIN     22        // ESP32 default I2C SCL (Connected to MPU6050 & OLED)

#define OLED_RESET      -1        // Reset pin # (or -1 if sharing Arduino reset pin)
#define SCREEN_WIDTH    128       // OLED display width in pixels
#define SCREEN_HEIGHT   64        // OLED display height in pixels
#define OLED_I2C_ADDR   0x3C      // Typically 0x3C or 0x3D for SSD1306

// --- 4. Transmission & Refresh Intervals ---
#define TELEMETRY_INTERVAL_MS   1000   // Send reading every 1000 ms (1 Hz)
#define OLED_REFRESH_INTERVAL_MS 250   // 4 Hz refresh for OLED display
#define MAX_HTTP_TIMEOUT_MS     6000   // 6 second timeout for HTTPS request

// --- 5. Optional Local WebSocket Server (For http://localhost only) ---
#define ENABLE_LOCAL_WS_SERVER  true
#define LOCAL_WS_PORT           81

#endif // CONFIG_H
