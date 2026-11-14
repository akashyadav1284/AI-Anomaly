/*
 * =====================================================================================
 *  IoT Anomaly Guard - Physical Sensor Firmware for ESP32 (Wi-Fi + WebSocket & HTTP)
 * =====================================================================================
 *  Target Hardware:
 *    - ESP32 DevKit V1 (with Integrated 2.4 GHz Wi-Fi)
 *    - DHT22 (AM2302) Temperature & Relative Humidity Sensor
 *    - MPU6050 6-Axis Accelerometer & Gyroscope (I2C 0x68)
 *    - SSD1306 0.96" OLED Display 128x64 (I2C 0x3C)
 *
 *  Connectivity:
 *    - Uses ESP32's built-in Wi-Fi radio (no extra Wi-Fi module needed)
 *    - WebSocket streaming (10-20 Hz) for real-time MPU6050 3D visualization
 *    - Automatic fallback to HTTP POST if WebSocket is disabled
 *    - Dual sensor acquisition (DHT22 on GPIO4, MPU6050 on I2C GPIO21/22)
 *    - Dynamic OLED local monitoring with Wi-Fi signal & WebSocket state
 * =====================================================================================
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <WebSocketsClient.h>
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
WebSocketsClient webSocket;

// --- Telemetry State Variables ---
unsigned long lastTelemetryTime = 0;
unsigned long lastDhtTime = 0;
unsigned long lastOledTime = 0;
unsigned long sequenceNumber = 0;

// Cached Sensor Values
float currentTemp = 24.5;
float currentHumidity = 45.0;
float accelX = 0.0, accelY = 0.0, accelZ = 9.81;
float gyroX = 0.0, gyroY = 0.0, gyroZ = 0.0;
float accelMagnitude = 9.81;
float vibrationRms = 0.0;

// Hardware Health Flags
bool dhtHealthy = false;
bool mpuHealthy = false;
bool oledHealthy = false;
bool wsConnected = false;

// Network & Transmission Diagnostics
String lastTransmissionStatus = "INIT";
int lastHttpCode = 0;
unsigned long successfulTransmissions = 0;
unsigned long failedTransmissions = 0;

// High-frequency vibration sampling buffer (10 samples)
#define VIB_SAMPLE_COUNT 10
float vibHistory[VIB_SAMPLE_COUNT] = {0};
int vibIndex = 0;

// --- Function Declarations ---
void initOled();
void initMPU6050();
void initDHT22();
void initWebSocket();
void connectWiFi();
void readDHT22();
void readMPU6050();
void updateOledDisplay();
void sendTelemetryPayload();
void sendWebSocketPayload();
void webSocketEvent(WStype_t type, uint8_t * payload, size_t length);

// =========================================================================
// SETUP
// =========================================================================

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n=======================================================");
  Serial.println("  IoT Anomaly Guard - Physical ESP32 Hardware Node");
  Serial.println("  Integrated Wi-Fi + MPU6050 + DHT22 + OLED Display");
  Serial.println("=======================================================");

  // Initialize I2C Bus for MPU6050 & OLED
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
  Wire.setClock(400000); // 400kHz fast I2C

  // 1. Initialize Display
  initOled();

  // 2. Initialize Sensors
  initMPU6050();
  initDHT22();

  // 3. Connect to Wi-Fi via built-in ESP32 Wi-Fi module
  connectWiFi();

  // 4. Initialize WebSocket Client if enabled
#if USE_WEBSOCKET
  initWebSocket();
#endif

  Serial.println("[SYSTEM] Hardware initialization sequence completed.");
}

// =========================================================================
// MAIN LOOP (Non-blocking design)
// =========================================================================

void loop() {
  unsigned long now = millis();

  // Maintain Wi-Fi auto-reconnection
  if (WiFi.status() != WL_CONNECTED) {
    static unsigned long lastWifiRetry = 0;
    if (now - lastWifiRetry > 10000) {
      lastWifiRetry = now;
      Serial.println("[NETWORK] Wi-Fi lost. Attempting reconnection...");
      WiFi.reconnect();
    }
  }

#if USE_WEBSOCKET
  // Process WebSocket events
  webSocket.loop();
#endif

  // Sample MPU6050 continuously
  readMPU6050();

  // Sample DHT22 every 2 seconds (DHT22 minimum internal refresh interval)
  if (now - lastDhtTime >= 2000) {
    lastDhtTime = now;
    readDHT22();
  }

  // Refresh OLED Display
  if (now - lastOledTime >= OLED_REFRESH_INTERVAL_MS) {
    lastOledTime = now;
    updateOledDisplay();
  }

  // Telemetry Transmission Dispatch
#if USE_WEBSOCKET
  if (now - lastTelemetryTime >= WS_TELEMETRY_INTERVAL_MS) {
    lastTelemetryTime = now;
    sendWebSocketPayload();
  }
#else
  if (now - lastTelemetryTime >= HTTP_TELEMETRY_INTERVAL_MS) {
    lastTelemetryTime = now;
    sendTelemetryPayload();
  }
#endif
}

// =========================================================================
// HARDWARE INITIALIZERS
// =========================================================================

void initOled() {
  if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_I2C_ADDR)) {
    Serial.println("[WARN] SSD1306 OLED allocation failed. Continuing headless.");
    oledHealthy = false;
  } else {
    oledHealthy = true;
    display.clearDisplay();
    display.setTextColor(SSD1306_WHITE);
    display.setTextSize(1);
    display.setCursor(0, 8);
    display.println("IoT Anomaly Guard");
    display.println("---------------------");
    display.println("ESP32 Physical Node");
    display.println("Wi-Fi Connecting...");
    display.display();
  }
}

void initMPU6050() {
  if (!mpu.begin()) {
    Serial.println("[ERROR] Failed to locate MPU6050 chip at 0x68. Check wiring (VCC, GND, SDA, SCL).");
    mpuHealthy = false;
  } else {
    mpuHealthy = true;
    mpu.setAccelerometerRange(MPU6050_RANGE_4_G);
    mpu.setGyroRange(MPU6050_RANGE_500_DEG);
    mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
    Serial.println("[SENSOR] MPU6050 motion sensor initialized successfully.");
  }
}

void initDHT22() {
  dht.begin();
  delay(100);
  float testT = dht.readTemperature();
  if (isnan(testT)) {
    Serial.println("[WARN] Initial DHT22 read returned NaN. Sensor will warm up.");
    dhtHealthy = false;
  } else {
    dhtHealthy = true;
    currentTemp = testT;
    currentHumidity = dht.readHumidity();
    Serial.println("[SENSOR] DHT22 environmental sensor online.");
  }
}

// =========================================================================
// WI-FI & WEBSOCKET NETWORKING
// =========================================================================

void connectWiFi() {
  Serial.printf("[NETWORK] Connecting to Wi-Fi SSID: %s\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long startAttempt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startAttempt < 15000) {
    delay(400);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n[NETWORK] Wi-Fi Connected! Node IP: %s | RSSI: %d dBm\n", 
                  WiFi.localIP().toString().c_str(), WiFi.RSSI());
  } else {
    Serial.println("\n[WARN] Wi-Fi connection timed out. Firmware will auto-reconnect in loop.");
  }
}

void initWebSocket() {
  Serial.printf("[WEBSOCKET] Connecting to ws://%s:%d%s\n", WS_HOST, WS_PORT, WS_PATH);
#if WS_USE_SSL
  webSocket.beginSSL(WS_HOST, WS_PORT, WS_PATH);
#else
  webSocket.begin(WS_HOST, WS_PORT, WS_PATH);
#endif
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(3000);
}

void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED:
      wsConnected = false;
      lastTransmissionStatus = "WS_DISC";
      Serial.println("[WEBSOCKET] Disconnected from server.");
      break;
    case WStype_CONNECTED:
      wsConnected = true;
      lastTransmissionStatus = "WS_OK";
      Serial.printf("[WEBSOCKET] Connected to server: %s\n", payload);
      break;
    case WStype_TEXT:
      // Server ACK or inference status
      break;
    case WStype_ERROR:
      wsConnected = false;
      lastTransmissionStatus = "WS_ERR";
      Serial.println("[WEBSOCKET] Communication error encountered.");
      break;
    default:
      break;
  }
}

// =========================================================================
// SENSOR ACQUISITION
// =========================================================================

void readDHT22() {
  float t = dht.readTemperature();
  float h = dht.readHumidity();

  if (isnan(t) || isnan(h)) {
    dhtHealthy = false;
  } else {
    dhtHealthy = true;
    currentTemp = t;
    currentHumidity = h;
  }
}

void readMPU6050() {
  if (!mpuHealthy) {
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

  // Vector acceleration magnitude: sqrt(ax^2 + ay^2 + az^2)
  accelMagnitude = sqrt((accelX * accelX) + (accelY * accelY) + (accelZ * accelZ));

  // Dynamic deviation from 1G standard gravity (9.80665 m/s^2)
  float dynamicDelta = abs(accelMagnitude - 9.80665);
  vibHistory[vibIndex] = dynamicDelta;
  vibIndex = (vibIndex + 1) % VIB_SAMPLE_COUNT;

  // Vibration RMS calculation
  float sumSq = 0.0;
  for (int i = 0; i < VIB_SAMPLE_COUNT; i++) {
    sumSq += (vibHistory[i] * vibHistory[i]);
  }
  vibrationRms = sqrt(sumSq / VIB_SAMPLE_COUNT);
}

// =========================================================================
// WEBSOCKET TRANSMISSION (High Frequency 10-20 Hz)
// =========================================================================

void sendWebSocketPayload() {
  if (WiFi.status() != WL_CONNECTED) {
    lastTransmissionStatus = "NO_WIFI";
    return;
  }

  if (!wsConnected) {
    lastTransmissionStatus = "WS_WAIT";
    return;
  }

  sequenceNumber++;

  String jsonPayload = "{";
  jsonPayload += "\"device_id\":\"" + String(DEVICE_ID) + "\",";
  jsonPayload += "\"source\":\"physical\",";
  jsonPayload += "\"sequence\":" + String(sequenceNumber) + ",";
  jsonPayload += "\"sensors\":{";
  jsonPayload += "\"temperature\":" + String(currentTemp, 1) + ",";
  jsonPayload += "\"humidity\":" + String(currentHumidity, 1) + ",";
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

  bool success = webSocket.sendTXT(jsonPayload);
  if (success) {
    lastTransmissionStatus = "WS_STREAM";
    successfulTransmissions++;
  } else {
    lastTransmissionStatus = "WS_DROP";
    failedTransmissions++;
  }
}

// =========================================================================
// HTTP POST TRANSMISSION (Fallback 1 Hz)
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

  if (httpCode == HTTP_CODE_OK || httpCode == HTTP_CODE_CREATED) {
    lastTransmissionStatus = "HTTP_OK";
    successfulTransmissions++;
  } else {
    lastTransmissionStatus = "HTTP_ERR";
    failedTransmissions++;
  }

  http.end();
}

// =========================================================================
// OLED STATUS DISPLAY
// =========================================================================

void updateOledDisplay() {
  if (!oledHealthy) return;

  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);

  // Header Line
  display.setCursor(0, 0);
  display.print("IoT Anomaly Guard");

  // Wi-Fi Status Icon / Indicator
  display.setCursor(102, 0);
  if (WiFi.status() == WL_CONNECTED) {
    display.print("[WiFi]");
  } else {
    display.print("[--]");
  }

  display.drawLine(0, 10, 128, 10, SSD1306_WHITE);

  // Line 1: Temperature & Humidity
  display.setCursor(0, 13);
  display.printf("T: %.1fC  H: %.1f%%", currentTemp, currentHumidity);

  // Line 2: Acceleration Magnitude & Vibration
  display.setCursor(0, 24);
  display.printf("Mag: %.2fm/s2", accelMagnitude);

  display.setCursor(0, 35);
  display.printf("Vib: %.3f RMS", vibrationRms);

  // Status Divider
  display.drawLine(0, 47, 128, 47, SSD1306_WHITE);

  // Bottom Line: Telemetry Protocol & State
  display.setCursor(0, 52);
  display.printf("#%lu [%s]", sequenceNumber, lastTransmissionStatus.c_str());

  display.display();
}
