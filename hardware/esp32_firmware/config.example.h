#ifndef CONFIG_H
#define CONFIG_H

// =========================================================================
// IoT Anomaly Guard - ESP32 Physical Telemetry Node Configuration
// =========================================================================
// Enter your 2.4GHz Hotspot SSID and Password below.
// =========================================================================

// --- 1. Wi-Fi Hotspot Configuration (2.4 GHz) ---
#define WIFI_SSID       "YOUR_HOTSPOT_SSID"
#define WIFI_PASSWORD   "YOUR_HOTSPOT_PASSWORD"

// --- 2. Local Web Server Port ---
// ESP32 hosts an HTTP server on port 80 at http://<ESP32_IP>/data
#define LOCAL_HTTP_PORT 80

// --- 3. Hardware Pinout Configuration ---
#define DHT_PIN         4         // GPIO4 connected to DHT22 DATA pin
#define DHT_TYPE        DHT22     // Sensor type DHT22 (AM2302)

#define I2C_SDA_PIN     21        // ESP32 default I2C SDA (Connected to MPU6050 & OLED)
#define I2C_SCL_PIN     22        // ESP32 default I2C SCL (Connected to MPU6050 & OLED)

#define OLED_RESET      -1        // Reset pin # (or -1 if sharing Arduino reset pin)
#define SCREEN_WIDTH    128       // OLED display width in pixels
#define SCREEN_HEIGHT   64        // OLED display height in pixels
#define OLED_I2C_ADDR   0x3C      // Typically 0x3C or 0x3D for SSD1306

// --- 4. Device Identification & Interval ---
#define DEVICE_ID       "ESP32_PHYSICAL_01"
#define OLED_REFRESH_INTERVAL_MS 200    // 5 Hz refresh for OLED display

#endif // CONFIG_H
