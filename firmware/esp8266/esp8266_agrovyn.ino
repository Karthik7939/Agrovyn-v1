/*
 * ====================================================================
 * AGROVYN: Smart Adaptive Greenhouse - ESP8266 Firmware
 * Hardware Architecture: NodeMCU ESP8266 + ADS1015 ADC + DHT11
 * Serial Bridge: SoftwareSerial (D6 RX, D7 TX) -> Arduino Uno (Pin 2 RX, Pin 3 TX)
 * ====================================================================
 */

#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <Wire.h>
#include <Adafruit_ADS1X15.h>
#include <SoftwareSerial.h>

// Wi-Fi Credentials (must be 2.4GHz — ESP8266 does NOT support 5GHz)
const char* ssid     = "UMAK FIBERNET-2.4G";
const char* password = "karthik42122580";

// FastAPI Backend URL — store in flash (PROGMEM) to save IRAM
static const char BACKEND_URL[] PROGMEM = "http://192.168.1.42:8000/api/sensors";
static const char POLL_URL[]    PROGMEM = "http://192.168.1.42:8000/api/hardware/poll";
static const char DEVICE_ID[]   PROGMEM = "greenhouse-esp8266-01";

// Sensor Pins
#define DHTPIN  D5
#define DHTTYPE DHT11

// Software Serial to Arduino (D6 = RX, D7 = TX)
SoftwareSerial linkSerial(D6, D7);

DHT dht(DHTPIN, DHTTYPE);
Adafruit_ADS1015 ads;

unsigned long lastSensorTime = 0;
unsigned long lastPollTime   = 0;
const unsigned long sensorInterval = 5000;  // 5 seconds telemetry
const unsigned long pollInterval   = 1000;  // 1 second command poll — keeps pump latency low

void setup() {
  Serial.begin(115200);      // USB Debugging to Computer
  linkSerial.begin(9600);    // SoftwareSerial to Arduino Uno (D6 RX, D7 TX)
  delay(500);

  dht.begin();
  Wire.begin(D2, D1);        // SDA = D2, SCL = D1 for ADS1015 I2C

  if (!ads.begin()) {
    Serial.println(F("ADS1015 ADC Warning: Module not found!"));
  }

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(F("."));
  }
  Serial.println(F("\nWiFi Connected!"));
  Serial.print(F("  IP:      ")); Serial.println(WiFi.localIP());
  Serial.print(F("  Gateway: ")); Serial.println(WiFi.gatewayIP());
  Serial.print(F("  Subnet:  ")); Serial.println(WiFi.subnetMask());
  Serial.print(F("  DNS:     ")); Serial.println(WiFi.dnsIP());
  Serial.print(F("  Backend: ")); Serial.println(FPSTR(BACKEND_URL));
}

void loop() {
  unsigned long now = millis();

  // Sensor telemetry — every 5 seconds
  if (now - lastSensorTime >= sensorInterval) {
    lastSensorTime = now;
    readAndPostTelemetry();
  }

  // Hardware command poll — every 1 second (separate from sensor posting)
  // This keeps pump ON/OFF response latency under 1 second.
  if (now - lastPollTime >= pollInterval) {
    lastPollTime = now;
    pollHardwareCommands();
  }
}

void readAndPostTelemetry() {
  float temp = dht.readTemperature();
  float hum  = dht.readHumidity();

  if (isnan(temp) || isnan(hum)) {
    temp = 28.9;
    hum  = 62.0;
  }

  int16_t soil_raw = ads.readADC_SingleEnded(0); // ADS1015 A0 = Soil Moisture
  int16_t ldr_raw  = ads.readADC_SingleEnded(1); // ADS1015 A1 = LDR Light

  // Soil Moisture Calibration:
  //   SOIL_DRY = raw reading when sensor is in open air (completely dry) -> 0%
  //   SOIL_WET = raw reading when sensor is submerged in water           -> 100%
  const int SOIL_DRY = 800;
  const int SOIL_WET = 320;

  float soil_pct = map(soil_raw, SOIL_DRY, SOIL_WET, 0, 100);
  soil_pct = constrain(soil_pct, 0.0, 100.0);

  float ldr_pct = map(ldr_raw, 100, 1800, 0, 100);
  ldr_pct = constrain(ldr_pct, 0.0, 100.0);

  if (WiFi.status() == WL_CONNECTED) {
    WiFiClient client;
    HTTPClient http;

    // Copy PROGMEM URL into a stack String for HTTPClient
    String url = FPSTR(BACKEND_URL);
    http.begin(client, url);
    http.addHeader(F("Content-Type"), F("application/json"));

    StaticJsonDocument<256> doc;
    doc[F("device_id")]             = FPSTR(DEVICE_ID);
    doc[F("temperature")]           = temp;
    doc[F("humidity")]              = hum;
    doc[F("soil_moisture_raw")]     = soil_raw;
    doc[F("soil_moisture_percent")] = soil_pct;
    doc[F("ldr_raw")]               = ldr_raw;
    doc[F("ldr_percent")]           = ldr_pct;

    String jsonString;
    serializeJson(doc, jsonString);

    int httpResponseCode = http.POST(jsonString);
    Serial.print(F("[SENSOR] POST -> HTTP "));
    Serial.println(httpResponseCode);
    http.end();
  }
}

void pollHardwareCommands() {
  if (WiFi.status() != WL_CONNECTED) return;

  WiFiClient client;
  HTTPClient http;

  String url = FPSTR(POLL_URL);
  http.begin(client, url);
  int httpCode = http.GET();

  if (httpCode == HTTP_CODE_OK) {
    String payload = http.getString();
    StaticJsonDocument<512> doc;
    deserializeJson(doc, payload);

    JsonArray cmds = doc[F("pending_commands")].as<JsonArray>();
    for (JsonObject cmdObj : cmds) {
      const char* cmdStr = cmdObj[F("command")];
      if (cmdStr) {
        // Send command string over SoftwareSerial (D7 TX) to Arduino (Pin 2 RX)
        linkSerial.println(cmdStr);
        Serial.print(F("[CMD] Sent to Arduino: "));
        Serial.println(cmdStr);
      }
    }
  }
  http.end();
}
