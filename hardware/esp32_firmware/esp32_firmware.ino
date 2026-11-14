/*
 * =====================================================================================
 *  IoT Anomaly Guard - Physical ESP32 Node Firmware (Dual-Mode Wi-Fi Hub)
 * =====================================================================================
 *  Hardware Pinout:
 *    - DHT22 DATA   --> GPIO 4 (with 10k pull-up to 3.3V)
 *    - MPU6050 SDA  --> GPIO 21 (I2C Default)
 *    - MPU6050 SCL  --> GPIO 22 (I2C Default)
 *    - SSD1306 SDA  --> GPIO 21 (Shared I2C at 0x3C)
 *    - SSD1306 SCL  --> GPIO 22 (Shared I2C at 0x3C)
 *
 *  Networking & Architecture:
 *    - Mode A (Local Web Hub - Direct Browser Pairing):
 *        Hosts a local WebSocket server directly on port 81 (ws://<ESP32_IP>:81/).
 *        The React website can pair directly to this IP with 0ms cloud lag!
 *        Allows instantaneous 3D MPU6050 attitude tracking & live gauges.
 *
 *    - Mode B (Cloud Ingestion Pipeline):
 *        Connects as a WebSocket client to your FastAPI backend / Render cloud at
 *        /api/v1/sensors/ws/ingest to store readings in MongoDB & run ML anomaly checks.
 *
 *    - SSD1306 OLED displays IP address, Wi-Fi status, client counts & sensor metrics.
 * =====================================================================================
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <WebSocketsServer.h>
#include <WebSocketsClient.h>
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

// Local WebSocket Server on Port 81 for direct website pairing
WebSocketsServer wsServer(LOCAL_WS_PORT);

// Optional Cloud Ingestion Client
#if ENABLE_CLOUD_INGEST
WebSocketsClient wsCloudClient;
bool wsCloudConnected = false;
#endif

// --- State Variables ---
unsigned long lastTelemetryTime = 0;
unsigned long lastDhtTime = 0;
unsigned long lastOledTime = 0;
unsigned long sequenceNumber = 0;
uint8_t connectedLocalClients = 0;

// Sensor Readings
float currentTemp = 25.0;
float currentHumidity = 50.0;
float accelX = 0.0, accelY = 0.0, accelZ = 9.81;
float gyroX = 0.0, gyroY = 0.0, gyroZ = 0.0;
float accelMagnitude = 9.81;
float vibrationRms = 0.0;

// Health Flags
bool dhtHealthy = false;
bool mpuHealthy = false;
bool oledHealthy = false;

// Vibration RMS buffer
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
void broadcastLocalWebSocket();
void onWebSocketServerEvent(uint8_t num, WStype_t type, uint8_t * payload, size_t length);

#if ENABLE_CLOUD_INGEST
void onCloudWsEvent(WStype_t type, uint8_t * payload, size_t length);
void sendCloudWebSocket();
#endif

// =========================================================================
// SETUP
// =========================================================================

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n=======================================================");
  Serial.println("  IoT Anomaly Guard - Physical ESP32 Hardware Node");
  Serial.println("  Wi-Fi WebSocket Hub & Live 3D MPU6050 Streamer");
  Serial.println("=======================================================");

  // Initialize Hardware I2C (Pins 21 and 22)
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
  Wire.setClock(400000); // 400kHz Fast Mode

  initOled();
  initMPU6050();
  initDHT22();

  // Connect to Wi-Fi
  connectWiFi();

  // Start Local WebSocket Server on Port 81
  wsServer.begin();
  wsServer.onEvent(onWebSocketServerEvent);
  Serial.printf("[WS SERVER] Local WebSocket server listening on ws://%s:%d/\n", 
                WiFi.localIP().toString().c_str(), LOCAL_WS_PORT);

#if ENABLE_CLOUD_INGEST
  // Start Cloud WebSocket Client if enabled
  Serial.printf("[CLOUD WS] Connecting to %s:%d%s\n", CLOUD_WS_HOST, CLOUD_WS_PORT, CLOUD_WS_PATH);
  #if CLOUD_WS_USE_SSL
    wsCloudClient.beginSSL(CLOUD_WS_HOST, CLOUD_WS_PORT, CLOUD_WS_PATH);
  #else
    wsCloudClient.begin(CLOUD_WS_HOST, CLOUD_WS_PORT, CLOUD_WS_PATH);
  #endif
  wsCloudClient.onEvent(onCloudWsEvent);
  wsCloudClient.setReconnectInterval(5000);
#endif

  Serial.println("[SYSTEM] Ready! Pair website directly using the IP displayed on OLED.");
}

// =========================================================================
// MAIN LOOP
// =========================================================================

void loop() {
  unsigned long now = millis();

  // Wi-Fi Connection Maintenance
  if (WiFi.status() != WL_CONNECTED) {
    static unsigned long lastWifiRetry = 0;
    if (now - lastWifiRetry > 8000) {
      lastWifiRetry = now;
      Serial.println("[NETWORK] Reconnecting Wi-Fi...");
      WiFi.reconnect();
    }
  }

  // Handle Local WebSocket Server Clients
  wsServer.loop();

#if ENABLE_CLOUD_INGEST
  wsCloudClient.loop();
#endif

  // Sample MPU6050 continuously
  readMPU6050();

  // Read DHT22 every 2 seconds
  if (now - lastDhtTime >= 2000) {
    lastDhtTime = now;
    readDHT22();
  }

  // Refresh OLED Display (4 Hz)
  if (now - lastOledTime >= OLED_REFRESH_INTERVAL_MS) {
    lastOledTime = now;
    updateOledDisplay();
  }

  // Broadcast Telemetry Frames via WebSocket (20 Hz / 50ms)
  if (now - lastTelemetryTime >= WS_STREAM_INTERVAL_MS) {
    lastTelemetryTime = now;
    broadcastLocalWebSocket();

#if ENABLE_CLOUD_INGEST
    sendCloudWebSocket();
#endif
  }
}

// =========================================================================
// WEBSOCKET SERVER EVENT HANDLER (DIRECT WEBSITE PAIRING)
// =========================================================================

void onWebSocketServerEvent(uint8_t num, WStype_t type, uint8_t * payload, size_t length) {
  switch (type) {
    case WStype_DISCONNECTED:
      if (connectedLocalClients > 0) connectedLocalClients--;
      Serial.printf("[WS CLIENT #%u] Disconnected. Active clients: %u\n", num, connectedLocalClients);
      break;
    case WStype_CONNECTED: {
      connectedLocalClients++;
      IPAddress ip = wsServer.remoteIP(num);
      Serial.printf("[WS CLIENT #%u] Connected from %d.%d.%d.%d! Streaming active.\n",
                    num, ip[0], ip[1], ip[2], ip[3]);
      // Send greeting ACK
      wsServer.sendTXT(num, "{\"event_type\":\"connected\",\"device_id\":\"ESP32_PHYSICAL_01\",\"status\":\"ready\"}");
      break;
    }
    case WStype_TEXT:
      if (strcmp((char*)payload, "ping") == 0) {
        wsServer.sendTXT(num, "{\"event_type\":\"pong\"}");
      }
      break;
    default:
      break;
  }
}

// =========================================================================
// BROADCAST TO LOCAL CONNECTED BROWSER CLIENTS
// =========================================================================

void broadcastLocalWebSocket() {
  if (connectedLocalClients == 0) return;

  sequenceNumber++;

  String json = "{";
  json += "\"event_type\":\"telemetry\",";
  json += "\"device_id\":\"" + String(DEVICE_ID) + "\",";
  json += "\"source\":\"physical\",";
  json += "\"sequence\":" + String(sequenceNumber) + ",";
  json += "\"timestamp\":\"" + String(millis()) + "\",";
  json += "\"features\":{";
  json += "\"temperature\":" + String(currentTemp, 1) + ",";
  json += "\"humidity\":" + String(currentHumidity, 1) + ",";
  json += "\"accel_x\":" + String(accelX, 3) + ",";
  json += "\"accel_y\":" + String(accelY, 3) + ",";
  json += "\"accel_z\":" + String(accelZ, 3) + ",";
  json += "\"gyro_x\":" + String(gyroX, 3) + ",";
  json += "\"gyro_y\":" + String(gyroY, 3) + ",";
  json += "\"gyro_z\":" + String(gyroZ, 3) + ",";
  json += "\"acceleration_magnitude\":" + String(accelMagnitude, 3) + ",";
  json += "\"vibration_rms\":" + String(vibrationRms, 4);
  json += "}";
  json += "}";

  wsServer.broadcastTXT(json);
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
    display.setCursor(0, 4);
    display.println("IoT Anomaly Guard");
    display.println("---------------------");
    display.println("ESP32 Physical Node");
    display.println("Connecting Wi-Fi...");
    display.display();
  }
}

void initMPU6050() {
  if (!mpu.begin()) {
    Serial.println("[ERROR] Failed to locate MPU6050 at I2C 0x68. Check wiring (VCC, GND, SDA=21, SCL=22).");
    mpuHealthy = false;
  } else {
    mpuHealthy = true;
    mpu.setAccelerometerRange(MPU6050_RANGE_4_G);
    mpu.setGyroRange(MPU6050_RANGE_500_DEG);
    mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
    Serial.println("[SENSOR] MPU6050 6-Axis Motion Sensor Online.");
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
    Serial.println("[SENSOR] DHT22 Temperature & Humidity Online.");
  }
}

// =========================================================================
// WI-FI SETUP
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
    Serial.printf("\n[NETWORK] Connected!\n");
    Serial.printf(">>> ESP32 IP ADDRESS: %s <<<\n", WiFi.localIP().toString().c_str());
    Serial.printf(">>> Enter this IP on your website to connect directly <<<\n");
  } else {
    Serial.println("\n[WARN] Wi-Fi connection timed out. Will auto-retry in background.");
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

  accelMagnitude = sqrt((accelX * accelX) + (accelY * accelY) + (accelZ * accelZ));

  // Dynamic deviation from 1G earth gravity
  float dynamicDelta = abs(accelMagnitude - 9.80665);
  vibHistory[vibIndex] = dynamicDelta;
  vibIndex = (vibIndex + 1) % VIB_SAMPLE_COUNT;

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

  // Line 0: Header & Wi-Fi status
  display.setCursor(0, 0);
  display.print("IoT Anomaly Guard");
  display.setCursor(102, 0);
  display.print(WiFi.status() == WL_CONNECTED ? "[WiFi]" : "[--]");
  display.drawLine(0, 9, 128, 9, SSD1306_WHITE);

  // Line 1: IP Address for Website Pairing
  display.setCursor(0, 12);
  if (WiFi.status() == WL_CONNECTED) {
    display.printf("IP:%s", WiFi.localIP().toString().c_str());
  } else {
    display.print("IP: Connecting...");
  }

  // Line 2: DHT22 Readings
  display.setCursor(0, 23);
  display.printf("T:%.1fC  H:%.1f%%", currentTemp, currentHumidity);

  // Line 3: MPU6050 Acceleration & Vibration
  display.setCursor(0, 34);
  display.printf("Mag:%.2f Vib:%.2f", accelMagnitude, vibrationRms);

  // Line 4: Clients & Mode
  display.drawLine(0, 46, 128, 46, SSD1306_WHITE);
  display.setCursor(0, 51);
  display.printf("Hub:P81 | WS Clients:%u", connectedLocalClients);

  display.display();
}

#if ENABLE_CLOUD_INGEST
void onCloudWsEvent(WStype_t type, uint8_t * payload, size_t length) {
  if (type == WStype_CONNECTED) {
    wsCloudConnected = true;
    Serial.println("[CLOUD WS] Ingestion pipeline established!");
  } else if (type == WStype_DISCONNECTED) {
    wsCloudConnected = false;
  }
}

void sendCloudWebSocket() {
  if (!wsCloudConnected) return;

  String json = "{";
  json += "\"device_id\":\"" + String(DEVICE_ID) + "\",";
  json += "\"source\":\"physical\",";
  json += "\"sequence\":" + String(sequenceNumber) + ",";
  json += "\"sensors\":{";
  json += "\"temperature\":" + String(currentTemp, 1) + ",";
  json += "\"humidity\":" + String(currentHumidity, 1) + ",";
  json += "\"accel_x\":" + String(accelX, 3) + ",";
  json += "\"accel_y\":" + String(accelY, 3) + ",";
  json += "\"accel_z\":" + String(accelZ, 3) + ",";
  json += "\"gyro_x\":" + String(gyroX, 3) + ",";
  json += "\"gyro_y\":" + String(gyroY, 3) + ",";
  json += "\"gyro_z\":" + String(gyroZ, 3) + ",";
  json += "\"acceleration_magnitude\":" + String(accelMagnitude, 3) + ",";
  json += "\"vibration_rms\":" + String(vibrationRms, 4);
  json += "}";
  json += "}";

  wsCloudClient.sendTXT(json);
}
#endif
