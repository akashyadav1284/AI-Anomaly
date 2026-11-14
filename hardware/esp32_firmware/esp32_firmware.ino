/*
 * =====================================================================================
 *  IoT Anomaly Guard - Physical ESP32 Node Firmware (Rock-Solid Hybrid Pipeline)
 * =====================================================================================
 *  Dual Streaming Architecture:
 *    1. CLOUD INGESTION PIPELINE (Primary):
 *       ESP32 transmits physical DHT22 + MPU6050 readings over Wi-Fi directly to the
 *       FastAPI backend at:
 *          https://ai-anomaly.onrender.com/api/v1/sensors/telemetry
 *       The backend immediately:
 *         a) Stores data in MongoDB Atlas.
 *         b) Runs AI anomaly detection (Z-score + physics vibration thresholding).
 *         c) Broadcasts live telemetry over Secure WebSocket (WSS) to ALL connected
 *            browsers and dashboards (Works everywhere, including college Wi-Fi & HTTPS).
 *
 *    2. LOCAL WEBSOCKET SERVER (Optional direct pairing on port 81):
 *       Hosts a local WebSocket server (ws://<ESP32_IP>:81) for local networks.
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
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <WebSocketsServer.h>
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

#if ENABLE_LOCAL_WS_SERVER
WebSocketsServer wsServer(LOCAL_WS_PORT);
uint8_t connectedLocalClients = 0;
#endif

// --- Telemetry State Variables ---
unsigned long lastTelemetryTime = 0;
unsigned long lastDhtTime = 0;
unsigned long lastOledTime = 0;
unsigned long sequenceNumber = 0;

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

// Diagnostics
String lastTxStatus = "INIT";
int lastHttpCode = 0;
unsigned long txSuccessCount = 0;
unsigned long txFailCount = 0;

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
void sendCloudTelemetry();

#if ENABLE_LOCAL_WS_SERVER
void broadcastLocalWebSocket();
void onWebSocketServerEvent(uint8_t num, WStype_t type, uint8_t * payload, size_t length);
#endif

// =========================================================================
// SETUP
// =========================================================================

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n=======================================================");
  Serial.println("  IoT Anomaly Guard - Physical ESP32 Hardware Node");
  Serial.println("  Dual-Pipeline: Cloud HTTPS + Local WebSocket");
  Serial.println("=======================================================");

  // Initialize Hardware I2C (Pins 21 and 22)
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
  Wire.setClock(400000); // 400kHz Fast Mode

  initOled();
  initMPU6050();
  initDHT22();

  // Connect to Wi-Fi using ESP32 onboard radio
  connectWiFi();

#if ENABLE_LOCAL_WS_SERVER
  wsServer.begin();
  wsServer.onEvent(onWebSocketServerEvent);
  Serial.printf("[LOCAL WS] Server listening on ws://%s:%d/\n", 
                WiFi.localIP().toString().c_str(), LOCAL_WS_PORT);
#endif

  Serial.println("[SYSTEM] Hardware ready. Cloud dispatch active.");
}

// =========================================================================
// MAIN LOOP
// =========================================================================

void loop() {
  unsigned long now = millis();

  // Wi-Fi Connection Maintenance
  if (WiFi.status() != WL_CONNECTED) {
    static unsigned long lastWifiRetry = 0;
    if (now - lastWifiRetry > 10000) {
      lastWifiRetry = now;
      Serial.println("[NETWORK] Wi-Fi lost. Attempting reconnection...");
      WiFi.reconnect();
    }
  }

#if ENABLE_LOCAL_WS_SERVER
  wsServer.loop();
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

  // Periodic Telemetry Dispatch (1 Hz to Cloud, 20 Hz to Local WS if connected)
  if (now - lastTelemetryTime >= TELEMETRY_INTERVAL_MS) {
    lastTelemetryTime = now;

    // Send to Cloud Ingestion (Powers the live website dashboard over WSS)
    sendCloudTelemetry();

#if ENABLE_LOCAL_WS_SERVER
    broadcastLocalWebSocket();
#endif
  }
}

// =========================================================================
// CLOUD INGESTION DISPATCH (HTTPS POST -> BACKEND -> WEBSOCKET BROADCAST)
// =========================================================================

void sendCloudTelemetry() {
  if (WiFi.status() != WL_CONNECTED) {
    lastTxStatus = "NO_WIFI";
    return;
  }

  sequenceNumber++;

  // Build JSON Payload
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

  // Stream clean JSON frame over Serial for direct USB WebSerial browser connection
  Serial.print("TELEMETRY_JSON:");
  Serial.println(jsonPayload);

  WiFiClientSecure client;
  client.setInsecure(); // Skip strict root CA verification for Render TLS
  
  HTTPClient http;
  if (!http.begin(client, BACKEND_URL)) {
    lastTxStatus = "CONN_FAIL";
    txFailCount++;
    return;
  }

  http.setTimeout(MAX_HTTP_TIMEOUT_MS);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-API-Key", DEVICE_API_KEY);

  int httpCode = http.POST(jsonPayload);
  lastHttpCode = httpCode;

  if (httpCode == HTTP_CODE_OK || httpCode == HTTP_CODE_CREATED) {
    lastTxStatus = "TX_OK";
    txSuccessCount++;
    Serial.printf("[TX #%lu] Live Telemetry sent successfully! (HTTP %d)\n", sequenceNumber, httpCode);
  } else {
    lastTxStatus = "ERR_" + String(httpCode);
    txFailCount++;
    Serial.printf("[TX #%lu] Backend returned code: %d\n", sequenceNumber, httpCode);
  }

  http.end();
}

#if ENABLE_LOCAL_WS_SERVER
// =========================================================================
// LOCAL WEBSOCKET SERVER EVENT HANDLER
// =========================================================================

void onWebSocketServerEvent(uint8_t num, WStype_t type, uint8_t * payload, size_t length) {
  switch (type) {
    case WStype_DISCONNECTED:
      if (connectedLocalClients > 0) connectedLocalClients--;
      Serial.printf("[LOCAL WS #%u] Disconnected\n", num);
      break;
    case WStype_CONNECTED: {
      connectedLocalClients++;
      IPAddress ip = wsServer.remoteIP(num);
      Serial.printf("[LOCAL WS #%u] Connected from %d.%d.%d.%d\n", num, ip[0], ip[1], ip[2], ip[3]);
      wsServer.sendTXT(num, "{\"event_type\":\"connected\",\"status\":\"ready\"}");
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

void broadcastLocalWebSocket() {
  if (connectedLocalClients == 0) return;

  String json = "{";
  json += "\"event_type\":\"telemetry\",";
  json += "\"device_id\":\"" + String(DEVICE_ID) + "\",";
  json += "\"source\":\"physical\",";
  json += "\"sequence\":" + String(sequenceNumber) + ",";
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
#endif

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
    Serial.println("[ERROR] MPU6050 not detected at 0x68. Check SDA=21, SCL=22.");
    mpuHealthy = false;
  } else {
    mpuHealthy = true;
    mpu.setAccelerometerRange(MPU6050_RANGE_4_G);
    mpu.setGyroRange(MPU6050_RANGE_500_DEG);
    mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
    Serial.println("[SENSOR] MPU6050 online.");
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
    Serial.println("[SENSOR] DHT22 online.");
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
    Serial.printf("\n[NETWORK] Connected! IP: %s\n", WiFi.localIP().toString().c_str());
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
        Serial.println("[INFO] MPU6050 reconnected.");
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

  // Line 0: Header & Wi-Fi Status
  display.setCursor(0, 0);
  display.print("IoT Anomaly Guard");
  display.setCursor(102, 0);
  display.print(WiFi.status() == WL_CONNECTED ? "[WiFi]" : "[--]");
  display.drawLine(0, 9, 128, 9, SSD1306_WHITE);

  // Line 1: IP Address
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

  // Line 4: Transmission State
  display.drawLine(0, 46, 128, 46, SSD1306_WHITE);
  display.setCursor(0, 51);
  display.printf("TX:#%lu [%s]", sequenceNumber, lastTxStatus.c_str());

  display.display();
}
