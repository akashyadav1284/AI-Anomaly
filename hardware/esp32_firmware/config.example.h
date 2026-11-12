#ifndef CONFIG_H
#define CONFIG_H

// =========================================================================
// IoT Anomaly Guard - ESP32 Physical Telemetry Node Configuration
// =========================================================================
// Rename this file to `config.h` and fill in your actual credentials.
// NEVER commit your real `config.h` with Wi-Fi credentials or production keys.
// =========================================================================

// --- 1. Wi-Fi Configuration ---
#define WIFI_SSID       "YOUR_WIFI_SSID"
#define WIFI_PASSWORD   "YOUR_WIFI_PASSWORD"

// --- 2. Backend Server Configuration ---
// For deployed cloud backend (Render):
// #define BACKEND_URL  "https://ai-anomaly.onrender.com/api/v1/sensors/telemetry"
// For local LAN testing (replace with your PC's local IP on Wi-Fi):
#define BACKEND_URL     "http://192.168.1.100:8000/api/v1/sensors/telemetry"

// --- 3. Security & Authentication ---
// Must match API_KEY in backend .env or settings (Default: "iot-secret-api-key-2026")
#define DEVICE_API_KEY  "iot-secret-api-key-2026"
#define DEVICE_ID       "ESP32_PHYSICAL_01"

// --- 4. Hardware Pinout Configuration ---
#define DHT_PIN         4         // GPIO4 connected to DHT22 DATA pin
#define DHT_TYPE        DHT22     // Sensor type DHT22 (AM2302)

#define I2C_SDA_PIN     21        // ESP32 default I2C SDA
#define I2C_SCL_PIN     22        // ESP32 default I2C SCL

#define OLED_RESET      -1        // Reset pin # (or -1 if sharing Arduino reset pin)
#define SCREEN_WIDTH    128       // OLED display width in pixels
#define SCREEN_HEIGHT   64        // OLED display height in pixels
#define OLED_I2C_ADDR   0x3C      // Typically 0x3C or 0x3D for SSD1306

// --- 5. Telemetry & Sampling Intervals ---
#define TELEMETRY_INTERVAL_MS   1000   // Send telemetry every 1000 ms (1 Hz)
#define OLED_REFRESH_INTERVAL_MS 250   // Refresh OLED animation every 250 ms
#define MAX_HTTP_TIMEOUT_MS     5000   // 5 second HTTP network timeout

#endif // CONFIG_H

