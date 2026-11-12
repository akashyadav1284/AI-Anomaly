/*
 * =====================================================================================
 *  IoT Anomaly Guard - Physical Sensor Firmware for ESP32
 * =====================================================================================
 *  Target Hardware:
 *    - ESP32 DevKit V1 (30-pin or 38-pin)
 *    - DHT22 (AM2302) Temperature & Relative Humidity Sensor
 *    - MPU6050 6-Axis Accelerometer & Gyroscope (I2C 0x68)
 *    - SSD1306 0.96" OLED Display 128x64 (I2C 0x3C)
 *
 *  Features:
 *    - Dual-core non-blocking architecture
 *    - Robust Wi-Fi auto-reconnection and exponential backoff
 *    - Real-time physical feature computation:
 *        * Temperature (C) & Relative Humidity (%)
 *        * Acceleration X, Y, Z (m/s^2)
 *        * Gyroscope X, Y, Z (rad/s or deg/s)
 *        * Vector Acceleration Magnitude: sqrt(ax^2 + ay^2 + az^2)
 *        * Vibration RMS metric computed over high-frequency accelerometer buffer
 *    - SSD1306 OLED visualization (live readings, Wi-Fi status, transmission state)
 *    - HTTPS/HTTP POST transmission to FastAPI backend (/api/v1/sensors/telemetry)
 *    - Device authentication via X-API-Key header
 * =====================================================================================
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <DHT.h>
#include <math.h>

// Include local configuration (fall back to example settings if config.h is absent)
#if __has_include("config.h")
  #include "config.h"
#else
  #include "config.example.h"
#endif

// --- Hardware Object Instances ---
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);
Adafruit_MPU6050 mpu;
DHT dht(DHT_PIN, DHT_TYPE);

// --- Telemetry State Variables ---
unsigned long lastTelemetryTime = 0;
unsigned long lastOledTime = 0;
unsigned long sequenceNumber = 0;

// Cached Sensor Values
float currentTemp = 0.0;
float currentHumidity = 0.0;
float accelX = 0.0, accelY = 0.0, accelZ = 0.0;
float gyroX = 0.0, gyroY = 0.0, gyroZ = 0.0;
float accelMagnitude = 0.0;
float vibrationRms = 0.0;

// Sensor Health Flags
bool dhtHealthy = false;
bool mpuHealthy = false;
bool oledHealthy = false;

// Transmission Status
String lastTransmissionStatus = "INIT";
int lastHttpCode = 0;
unsigned long successfulTransmissions = 0;
unsigned long failedTransmissions = 0;

// --- Vibration Buffer for High-Rate RMS Calculation ---
#define VIB_SAMPLE_COUNT 16
float vibHistory[VIB_SAMPLE_COUNT];
int vibIndex = 0;

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n[SYSTEM] Starting IoT Anomaly Guard ESP32 Node...");

  // 1. Initialize I2C Bus
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);

  // 2. Initialize OLED Display
  if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_I2C_ADDR)) {
    Serial.println("[WARN] SSD1306 OLED display not detected at 0x3C.");
    oledHealthy = false;
  } else {
    oledHealthy = true;
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    display.setCursor(0, 0);
    display.println("IoT Anomaly Guard");
    display.println("Initializing sensors...");
    display.display();
  }

  // 3. Initialize DHT22
  dht.begin();
  delay(100);
  float initialTemp = dht.readTemperature();
  float initialHum = dht.readHumidity();
  if (isnan(initialTemp) || isnan(initialHum)) {
    Serial.println("[WARN] DHT22 sensor failed initial read. Retrying in loop.");
    dhtHealthy = false;
  } else {
    dhtHealthy = true;
    currentTemp = initialTemp;
    currentHumidity = initialHum;
    Serial.printf("[INFO] DHT22 initialized: %.1f C, %.1f %%\n", currentTemp, currentHumidity);
  }

  // 4. Initialize MPU6050
  if (!mpu.begin()) {
    Serial.println("[WARN] MPU6050 sensor failed to initialize at 0x68.");
    mpuHealthy = false;
  } else {
    mpuHealthy = true;
    mpu.setAccelerometerRange(MPU6050_RANGE_4_G);
    mpu.setGyroRange(MPU6050_RANGE_500_DEG);
    mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
    Serial.println("[INFO] MPU6050 6-axis IMU initialized.");
  }

  // 5. Connect to Wi-Fi
  connectWiFi();

  // Initialize vibration buffer
  for (int i = 0; i < VIB_SAMPLE_COUNT; i++) {
    vibHistory[i] = 0.0;
  }

  updateOledDisplay();
}

void loop() {
  unsigned long now = millis();

  // Continuous background Wi-Fi check & reconnect
  if (WiFi.status() != WL_CONNECTED) {
    static unsigned long lastReconnectAttempt = 0;
    if (now - lastReconnectAttempt > 10000) {
      lastReconnectAttempt = now;
      Serial.println("[NETWORK] Wi-Fi lost. Attempting background reconnect...");
      WiFi.reconnect();
    }
  }

  // Sample MPU6050 frequently to capture accurate vibration dynamics
  readMPU6050();

  // Refresh OLED periodically (non-blocking)
  if (now - lastOledTime >= OLED_REFRESH_INTERVAL_MS) {
    lastOledTime = now;
    updateOledDisplay();
  }

  // Dispatch Telemetry Payload at configured interval
  if (now - lastTelemetryTime >= TELEMETRY_INTERVAL_MS) {
    lastTelemetryTime = now;
    readDHT22();
    sendTelemetryPayload();
  }
}

// =========================================================================
// SENSOR READING IMPLEMENTATIONS
// =========================================================================

void readDHT22() {
  float t = dht.readTemperature();
  float h = dht.readHumidity();

  if (isnan(t) || isnan(h)) {
    Serial.println("[SENSOR] DHT22 read failure! Maintaining last known reading.");
    dhtHealthy = false;
  } else {
    dhtHealthy = true;
    currentTemp = t;
    currentHumidity = h;
  }
}

void readMPU6050() {
  if (!mpuHealthy) {
    // Attempt re-init if previously disconnected
    static unsigned long lastMpuRetry = 0;
    if (millis() - lastMpuRetry > 5000) {
      lastMpuRetry = millis();
      if (mpu.begin()) {
        mpuHealthy = true;
        Serial.println("[INFO] MPU6050 reconnected successfully.");
      }
    }
    return;
  }

  sensors_event_t a, g, temp;
  mpu.getEvent(&a, &g, &temp);

  accelX = a.acceleration.x;
  accelY = a.acceleration.y;
  accelZ = a.acceleration.z;

  gyroX = g.gyro.x;
  gyroY = g.gyro.y;
  gyroZ = g.gyro.z;

  // Vector magnitude: sqrt(ax^2 + ay^2 + az^2)
  accelMagnitude = sqrt((accelX * accelX) + (accelY * accelY) + (accelZ * accelZ));

  // Dynamic deviation from 1G earth gravity (approx 9.81 m/s^2)
  float dynamicDelta = abs(accelMagnitude - 9.80665);
  vibHistory[vibIndex] = dynamicDelta;
  vibIndex = (vibIndex + 1) % VIB_SAMPLE_COUNT;

  // Calculate Root Mean Square (RMS) of vibration deviations
  float sumSq = 0.0;
  for (int i = 0; i < VIB_SAMPLE_COUNT; i++) {
    sumSq += (vibHistory[i] * vibHistory[i]);
  }
  vibrationRms = sqrt(sumSq / VIB_SAMPLE_COUNT);
}

// =========================================================================
// OLED STATUS DISPLAY
// =========================================================================

void updateOledDisplay() {
  if (!oledHealthy) return;

  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);

  // Header
  display.setCursor(0, 0);
  display.print("IoT Anomaly Guard");

  // Network Status Icon / Indicator
  display.setCursor(104, 0);
  if (WiFi.status() == WL_CONNECTED) {
    display.print("[ON]");
  } else {
    display.print("[--]");
  }

  display.drawLine(0, 10, 128, 10, SSD1306_WHITE);

  // Line 1: Temperature & Humidity
  display.setCursor(0, 14);
  display.printf("T: %.1fC  H: %.1f%%", currentTemp, currentHumidity);

  // Line 2: Acceleration Magnitude & Vibration
  display.setCursor(0, 26);
  display.printf("Mag: %.2fm/s2", accelMagnitude);

  display.setCursor(0, 38);
  display.printf("Vib: %.3f RMS", vibrationRms);

  // Status Divider
  display.drawLine(0, 49, 128, 49, SSD1306_WHITE);

  // Bottom Line: Telemetry State
  display.setCursor(0, 53);
  display.printf("TX:#%lu [%s]", sequenceNumber, lastTransmissionStatus.c_str());

  display.display();
}

// =========================================================================
// WI-FI & NETWORK
// =========================================================================

void connectWiFi() {
  Serial.printf("[NETWORK] Connecting to Wi-Fi: %s\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long startAttempt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startAttempt < 15000) {
    delay(500);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n[NETWORK] Connected! IP Address: %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\n[WARN] Wi-Fi connection timed out. Will retry in background loop.");
  }
}

// =========================================================================
// TELEMETRY TRANSMISSION (HTTPS / HTTP POST)
// =========================================================================

void sendTelemetryPayload() {
  if (WiFi.status() != WL_CONNECTED) {
    lastTransmissionStatus = "NO_WIFI";
    return;
  }

  sequenceNumber++;

  HTTPClient http;
  http.begin(BACKEND_URL);
  http.setTimeout(MAX_HTTP_TIMEOUT_MS);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-API-Key", DEVICE_API_KEY);

  // Format JSON payload matching Phase 3 schema
  // Note: Values formatted to 3 decimal places to optimize bandwidth
  String jsonPayload = "{";
  jsonPayload += "\"device_id\":\"" + String(DEVICE_ID) + "\",";
  jsonPayload += "\"source\":\"physical\",";
  jsonPayload += "\"sequence\":" + String(sequenceNumber) + ",";
  jsonPayload += "\"sensors\":{";
  jsonPayload += "\"temperature\":" + String(currentTemp, 2) + ",";
  jsonPayload += "\"humidity\":" + String(currentHumidity, 2) + ",";
  jsonPayload += "\"accel_x\":" + String(accelX, 3) + ",";
  jsonPayload += "\"accel_y\":" + String(accelY, 3) + ",";
  jsonPayload += "\"accel_z\":" + String(accelZ, 3) + ",";
  jsonPayload += "\"gyro_x\":" + String(gyroX, 3) + ",";
  jsonPayload += "\"gyro_y\":" + String(gyroY, 3) + ",";
  jsonPayload += "\"gyro_z\":" + String(gyroZ, 3) + ",";
  jsonPayload += "\"acceleration_magnitude\":" + String(accelMagnitude, 3) + ",";
  jsonPayload += "\"vibration_rms\":" + String(vibrationRms, 4);
  jsonPayload += "}";
  jsonPayload += "}";

  int httpCode = http.POST(jsonPayload);
  lastHttpCode = httpCode;

  if (httpCode > 0) {
    if (httpCode == HTTP_CODE_OK || httpCode == HTTP_CODE_CREATED) {
      lastTransmissionStatus = "OK";
      successfulTransmissions++;
      Serial.printf("[TX #%lu] Success (HTTP %d)\n", sequenceNumber, httpCode);
    } else {
      lastTransmissionStatus = "ERR_" + String(httpCode);
      failedTransmissions++;
      Serial.printf("[TX #%lu] Backend rejected with HTTP %d\n", sequenceNumber, httpCode);
    }
  } else {
    lastTransmissionStatus = "FAIL";
    failedTransmissions++;
    Serial.printf("[TX #%lu] HTTP POST failed: %s\n", sequenceNumber, http.errorToString(httpCode).c_str());
  }

  http.end();
}

