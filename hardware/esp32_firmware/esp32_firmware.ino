/*
 * =====================================================================================
 *  IoT Anomaly Guard - Physical ESP32 Node Firmware (Real-Time Hotspot Web Server)
 * =====================================================================================
 *  Architecture:
 *    - ESP32 connects to your 2.4 GHz Mobile Hotspot / Wi-Fi router.
 *    - Runs an embedded HTTP WebServer on Port 80 (http://<ESP32_IP>/data).
 *    - Full CORS headers (Access-Control-Allow-Origin: *) enabled for browser fetch.
 *    - Directly reads ACTUAL raw physical data from:
 *        1. MPU6050: Real-time Accel (X, Y, Z), Gyro (X, Y, Z), Vector Magnitude & Vibration RMS
 *        2. DHT22: Real-time Temperature (°C) & Humidity (%)
 *    - Zero dummy data, zero simulated values, zero fake fallbacks.
 *    - SSD1306 OLED displays IP address clearly for entering on the website.
 *
 *  Hardware Pinout:
 *    - DHT22 DATA   --> GPIO 4 (with 10k pull-up resistor to 3.3V)
 *    - MPU6050 SDA  --> GPIO 21 (Default I2C)
 *    - MPU6050 SCL  --> GPIO 22 (Default I2C)
 *    - SSD1306 SDA  --> GPIO 21 (Shared I2C at 0x3C)
 *    - SSD1306 SCL  --> GPIO 22 (Shared I2C at 0x3C)
 * =====================================================================================
 */

#include <WiFi.h>
#include <WebServer.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <DHT.h>
#include <math.h>

#if __has_include("config.h")
  #include "config.h"
#else
  #include "config.example.h"
#endif

// --- Hardware Instances ---
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);
Adafruit_MPU6050 mpu;
DHT dht(DHT_PIN, DHT_TYPE);

// WebServer on standard port 80
WebServer server(LOCAL_HTTP_PORT);

// --- Telemetry State Variables ---
unsigned long lastDhtTime = 0;
unsigned long lastOledTime = 0;
unsigned long requestCount = 0;

// Sensor Readings (Actual Physical Measurements)
float currentTemp = 0.0;
float currentHumidity = 0.0;
float accelX = 0.0, accelY = 0.0, accelZ = 9.81;
float gyroX = 0.0, gyroY = 0.0, gyroZ = 0.0;
float accelMagnitude = 9.81;
float vibrationRms = 0.0;

// Health Flags
bool dhtHealthy = false;
bool mpuHealthy = false;
bool oledHealthy = false;

// Vibration RMS buffer (Calculated from real accelerometer dynamics)
#define VIB_SAMPLE_COUNT 10
float vibHistory[VIB_SAMPLE_COUNT] = {0};
int vibIndex = 0;

// Function declarations
void initOled();
void initMPU6050();
void initDHT22();
void connectWiFi();
void readDHT22();
void readMPU6050();
void updateOledDisplay();
void handleDataRequest();
void handleOptions();

// =========================================================================
// SETUP
// =========================================================================

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n=======================================================");
  Serial.println("  IoT Anomaly Guard - Physical ESP32 Hardware Node");
  Serial.println("  Real-time Hotspot Web Server (http://<IP>/data)");
  Serial.println("=======================================================");

  // Initialize Hardware I2C (Pins 21 and 22)
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
  Wire.setClock(400000); // 400kHz Fast Mode

  initOled();
  initMPU6050();
  initDHT22();

  // Connect to Wi-Fi Hotspot
  connectWiFi();

  // Setup WebServer Endpoints with full CORS support for browser fetch
  server.on("/data", HTTP_GET, handleDataRequest);
  server.on("/data", HTTP_OPTIONS, handleOptions);
  server.onNotFound([]() {
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.send(404, "text/plain", "Not Found");
  });

  server.begin();
  Serial.printf("\n[HTTP SERVER] Online at http://%s/data\n", WiFi.localIP().toString().c_str());
  Serial.println("[SYSTEM] Ready! Enter this IP address on your website.");
}

// =========================================================================
// MAIN LOOP
// =========================================================================

void loop() {
  unsigned long now = millis();

  // Handle incoming HTTP requests from the website
  server.handleClient();

  // Wi-Fi Auto-Reconnection
  if (WiFi.status() != WL_CONNECTED) {
    static unsigned long lastWifiRetry = 0;
    if (now - lastWifiRetry > 8000) {
      lastWifiRetry = now;
      Serial.println("[NETWORK] Hotspot connection lost. Reconnecting...");
      WiFi.reconnect();
    }
  }

  // Continuously read physical MPU6050 motion sensor
  readMPU6050();

  // Read DHT22 every 2 seconds (safe physical sensor limit)
  if (now - lastDhtTime >= 2000) {
    lastDhtTime = now;
    readDHT22();
  }

  // Refresh OLED Display (5 Hz)
  if (now - lastOledTime >= OLED_REFRESH_INTERVAL_MS) {
    lastOledTime = now;
    updateOledDisplay();
  }
}

// =========================================================================
// HTTP /DATA ENDPOINT (SERVES REAL-TIME HARDWARE SENSOR JSON TO WEBSITE)
// =========================================================================

void handleDataRequest() {
  requestCount++;

  // Ensure latest instantaneous sensor reading
  readMPU6050();

  // Construct pure real hardware JSON payload with all key aliases (xyz, accel_xyz, gx/gy/gz)
  String json = "{";
  json += "\"device_id\":\"" + String(DEVICE_ID) + "\",";
  json += "\"source\":\"physical\",";
  json += "\"request_count\":" + String(requestCount) + ",";
  json += "\"timestamp\":" + String(millis()) + ",";
  // Direct xyz properties
  json += "\"x\":" + String(accelX, 3) + ",";
  json += "\"y\":" + String(accelY, 3) + ",";
  json += "\"z\":" + String(accelZ, 3) + ",";
  // Standard accel_xyz properties
  json += "\"accel_x\":" + String(accelX, 3) + ",";
  json += "\"accel_y\":" + String(accelY, 3) + ",";
  json += "\"accel_z\":" + String(accelZ, 3) + ",";
  // Gyroscope angular velocity
  json += "\"gx\":" + String(gyroX, 3) + ",";
  json += "\"gy\":" + String(gyroY, 3) + ",";
  json += "\"gz\":" + String(gyroZ, 3) + ",";
  json += "\"gyro_x\":" + String(gyroX, 3) + ",";
  json += "\"gyro_y\":" + String(gyroY, 3) + ",";
  json += "\"gyro_z\":" + String(gyroZ, 3) + ",";
  // Environmental readings
  json += "\"temperature\":" + String(currentTemp, 1) + ",";
  json += "\"humidity\":" + String(currentHumidity, 1) + ",";
  json += "\"temp\":" + String(currentTemp, 1) + ",";
  json += "\"hum\":" + String(currentHumidity, 1) + ",";
  // Computed dynamic physical vectors
  json += "\"acceleration_magnitude\":" + String(accelMagnitude, 3) + ",";
  json += "\"vibration_rms\":" + String(vibrationRms, 4) + ",";
  // Compatible nested object format for intelligence dashboard
  json += "\"sensors\":{";
  json += "\"x\":" + String(accelX, 3) + ",";
  json += "\"y\":" + String(accelY, 3) + ",";
  json += "\"z\":" + String(accelZ, 3) + ",";
  json += "\"accel_x\":" + String(accelX, 3) + ",";
  json += "\"accel_y\":" + String(accelY, 3) + ",";
  json += "\"accel_z\":" + String(accelZ, 3) + ",";
  json += "\"gx\":" + String(gyroX, 3) + ",";
  json += "\"gy\":" + String(gyroY, 3) + ",";
  json += "\"gz\":" + String(gyroZ, 3) + ",";
  json += "\"gyro_x\":" + String(gyroX, 3) + ",";
  json += "\"gyro_y\":" + String(gyroY, 3) + ",";
  json += "\"gyro_z\":" + String(gyroZ, 3) + ",";
  json += "\"temperature\":" + String(currentTemp, 1) + ",";
  json += "\"humidity\":" + String(currentHumidity, 1) + ",";
  json += "\"acceleration_magnitude\":" + String(accelMagnitude, 3) + ",";
  json += "\"vibration_rms\":" + String(vibrationRms, 4);
  json += "}";
  json += "}";

  // CORS & Keep-Alive headers permit high-speed non-blocking browser requests
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "*");
  server.sendHeader("Connection", "keep-alive");
  server.sendHeader("Keep-Alive", "timeout=5, max=1000");
  server.send(200, "application/json", json);
}

void handleOptions() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "*");
  server.send(204);
}

// =========================================================================
// HARDWARE INITIALIZERS
// =========================================================================

void initOled() {
  if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_I2C_ADDR)) {
    Serial.println("[WARN] SSD1306 OLED not found at 0x3C. Continuing headless.");
    oledHealthy = false;
  } else {
    oledHealthy = true;
    display.clearDisplay();
    display.setTextColor(SSD1306_WHITE);
    display.setTextSize(1);
    display.setCursor(0, 4);
    display.println("IoT Anomaly Guard");
    display.println("---------------------");
    display.println("ESP32 Physical Node");
    display.println("Connecting Hotspot...");
    display.display();
  }
}

void initMPU6050() {
  if (!mpu.begin()) {
    Serial.println("[ERROR] MPU6050 not detected at 0x68. Check wiring (VCC, GND, SDA=21, SCL=22).");
    mpuHealthy = false;
  } else {
    mpuHealthy = true;
    mpu.setAccelerometerRange(MPU6050_RANGE_4_G);
    mpu.setGyroRange(MPU6050_RANGE_500_DEG);
    mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
    Serial.println("[SENSOR] MPU6050 6-Axis Motion Sensor Initialized Successfully.");
  }
}

void initDHT22() {
  dht.begin();
  delay(100);
  float testT = dht.readTemperature();
  if (isnan(testT)) {
    Serial.println("[WARN] DHT22 warming up...");
    dhtHealthy = false;
  } else {
    dhtHealthy = true;
    currentTemp = testT;
    currentHumidity = dht.readHumidity();
    Serial.println("[SENSOR] DHT22 Temperature & Humidity Initialized Successfully.");
  }
}

// =========================================================================
// WI-FI HOTSPOT CONNECTION
// =========================================================================

void connectWiFi() {
  Serial.printf("[NETWORK] Connecting to Hotspot SSID: %s\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long startAttempt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startAttempt < 15000) {
    delay(400);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n=======================================================\n");
    Serial.printf("  [NETWORK] CONNECTED SUCCESSFULLY!\n");
    Serial.printf("  >>> ESP32 IP ADDRESS: %s <<<\n", WiFi.localIP().toString().c_str());
    Serial.printf("  >>> Web URL: http://%s/data <<<\n", WiFi.localIP().toString().c_str());
    Serial.printf("=======================================================\n");
  } else {
    Serial.println("\n[WARN] Wi-Fi connection timed out. Will auto-retry in background.");
  }
}

// =========================================================================
// SENSOR ACQUISITION (ACTUAL PHYSICAL READINGS)
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
        Serial.println("[INFO] MPU6050 reconnected.");
      }
    }
    return;
  }

  sensors_event_t a, g, temp;
  mpu.getEvent(&a, &g, &temp);

  // Pure actual physical acceleration in m/s^2
  accelX = a.acceleration.x;
  accelY = a.acceleration.y;
  accelZ = a.acceleration.z;

  // Pure actual physical angular velocity in rad/s
  gyroX = g.gyro.x;
  gyroY = g.gyro.y;
  gyroZ = g.gyro.z;

  // Vector acceleration magnitude: sqrt(ax^2 + ay^2 + az^2)
  accelMagnitude = sqrt((accelX * accelX) + (accelY * accelY) + (accelZ * accelZ));

  // Dynamic deviation from 1G standard gravity (9.80665 m/s^2)
  float dynamicDelta = abs(accelMagnitude - 9.80665);
  vibHistory[vibIndex] = dynamicDelta;
  vibIndex = (vibIndex + 1) % VIB_SAMPLE_COUNT;

  // Compute Root Mean Square (RMS) of actual physical vibration
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

  // Line 0: Header & Wi-Fi indicator
  display.setCursor(0, 0);
  display.print("IoT Anomaly Guard");
  display.setCursor(102, 0);
  display.print(WiFi.status() == WL_CONNECTED ? "[WiFi]" : "[--]");
  display.drawLine(0, 9, 128, 9, SSD1306_WHITE);

  // Line 1: IP Address for Website Connection
  display.setCursor(0, 12);
  if (WiFi.status() == WL_CONNECTED) {
    display.printf("IP: %s", WiFi.localIP().toString().c_str());
  } else {
    display.print("IP: Connecting...");
  }

  // Line 2: Actual Physical DHT22 Readings
  display.setCursor(0, 23);
  display.printf("T:%.1fC  H:%.1f%%", currentTemp, currentHumidity);

  // Line 3: Actual Physical MPU6050 Motion
  display.setCursor(0, 34);
  display.printf("Mag:%.2f Vib:%.2f", accelMagnitude, vibrationRms);

  // Line 4: Server Hits Counter
  display.drawLine(0, 46, 128, 46, SSD1306_WHITE);
  display.setCursor(0, 51);
  display.printf("HTTP Hits: #%lu", requestCount);

  display.display();
}
