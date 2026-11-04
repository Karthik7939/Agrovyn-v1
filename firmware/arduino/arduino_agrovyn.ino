/*
 * ====================================================================
 * AGROVYN: Smart Adaptive Greenhouse - Arduino Uno Actuator Firmware
 * Hardware Architecture: Arduino Uno + Dual Relay Controller
 *
 * Relay Pin Map:
 *   Pin D7  -> PDLC Controller Relay (simulates button press)
 *   Pin D8  -> Pump Motor Relay (NO/COM/IN wired to pump circuit)
 *
 * Relay module type: Optocoupler (active-LOW)
 *   IN = LOW  -> relay coil ON  -> NO contact closes -> current flows
 *   IN = HIGH -> relay coil OFF -> NO contact open   -> no current
 *
 * Communication: SoftwareSerial Pin 2 (RX) & Pin 3 (TX)
 *   Receives commands from ESP8266 (D7 TX -> Pin 2 RX)
 *
 * PDLC State Model (4-State Cyclic):
 *   State 0 = 0%   Fully Transparent
 *   State 1 = 33%  Light Tint
 *   State 2 = 66%  Medium Tint
 *   State 3 = 100% Fully Opaque
 *   clicks = (targetIdx - currentIdx + 4) % 4
 * ====================================================================
 */

#include <SoftwareSerial.h>

// SoftwareSerial: Pin 2 = RX (from ESP8266 D7), Pin 3 = TX (to ESP8266 D6)
SoftwareSerial linkSerial(2, 3);

// ---- Pin Definitions ----
#define RELAY_PDLC_PIN  7   // PDLC button relay
#define RELAY_PUMP_PIN  8   // Pump motor relay (IN -> D8, NO -> motor+, COM -> PSU+)

// Active-LOW relay: pull IN LOW to energise the coil and close NO contact
#define RELAY_ON  LOW
#define RELAY_OFF HIGH

// ---- PDLC 4-State Cyclic Model ----
#define NUM_PDLC_STATES 4
const int PDLC_STATE_OPACITIES[NUM_PDLC_STATES] = { 0, 33, 66, 100 };
int currentPdlcStateIndex = 0;

// ---- Pump Safety ----
unsigned long pumpStartTime = 0;
bool isPumpActive = false;
const unsigned long MAX_PUMP_RUNTIME_MS = 300000UL;  // 5-minute hard cutoff

// ---- Forward declarations ----
void processCommand(String cmd);
void startPump();
void stopPump();
void stopPumpSafetyCutoff();
void setPDLCOpacity(int targetOpacity);
int  opacityToStateIndex(int opacity);

// ===========================================================================
void setup() {
  Serial.begin(115200);
  linkSerial.begin(9600);

  pinMode(RELAY_PDLC_PIN, OUTPUT);
  pinMode(RELAY_PUMP_PIN, OUTPUT);

  // Safe initial state: both relays OFF
  digitalWrite(RELAY_PDLC_PIN, RELAY_OFF);
  digitalWrite(RELAY_PUMP_PIN, RELAY_OFF);

  Serial.println(F("AGROVYN Arduino Actuator Controller Ready."));
  Serial.print(F("Pump relay   -> D8 | RELAY_ON=LOW (active-LOW board)\n"));
  Serial.print(F("PDLC relay   -> D7\n"));
  Serial.print(F("Serial bridge-> Pin2(RX) Pin3(TX) at 9600 baud\n"));
  Serial.print(F("PDLC startup state: 0 (Transparent)\n"));
  Serial.println(F("Waiting for commands..."));
}

// ===========================================================================
void loop() {
  // --- Commands from ESP8266 via SoftwareSerial ---
  if (linkSerial.available() > 0) {
    String cmd = linkSerial.readStringUntil('\n');
    cmd.replace("\r", "");   // strip \r left by println()
    cmd.trim();
    if (cmd.length() > 0) {
      Serial.print(F("[ESP] "));
      Serial.println(cmd);
      processCommand(cmd);
    }
  }

  // --- Commands from USB Serial Monitor (for bench testing without ESP) ---
  // Type "PUMP:ON", "PUMP:OFF", "PDLC:66" etc. and press Enter
  if (Serial.available() > 0) {
    String cmd = Serial.readStringUntil('\n');
    cmd.replace("\r", "");
    cmd.trim();
    if (cmd.length() > 0) {
      Serial.print(F("[USB] "));
      Serial.println(cmd);
      processCommand(cmd);
    }
  }

  // --- Pump safety runtime watchdog ---
  if (isPumpActive && (millis() - pumpStartTime >= MAX_PUMP_RUNTIME_MS)) {
    stopPumpSafetyCutoff();
  }
}

// ===========================================================================
// Command router — case-insensitive substring matching for reliability.
// Substring matching (indexOf) is robust against any extra whitespace or
// framing bytes that SoftwareSerial may inject on a noisy UART line.
// PUMP:OFF is checked BEFORE PUMP:ON to avoid partial match issues.
// ===========================================================================
void processCommand(String cmd) {
  cmd.replace("\r", "");
  cmd.trim();
  String upper = cmd;
  upper.toUpperCase();

  if (upper.indexOf("PUMP:OFF") >= 0) {
    stopPump();
  } else if (upper.indexOf("PUMP:ON") >= 0) {
    startPump();
  } else if (upper.indexOf("PDLC:") >= 0) {
    int colon = upper.indexOf("PDLC:");
    int targetOpacity = upper.substring(colon + 5).toInt();
    setPDLCOpacity(targetOpacity);
  } else {
    Serial.print(F("[WARN] Unknown command: "));
    Serial.println(cmd);
  }
}

// ===========================================================================
// Pump control
// ===========================================================================
void startPump() {
  if (isPumpActive) {
    Serial.println(F("[PUMP] Already ON — ignoring duplicate PUMP:ON."));
    return;
  }
  pinMode(RELAY_PUMP_PIN, OUTPUT);       // re-affirm pin mode
  digitalWrite(RELAY_PUMP_PIN, RELAY_ON);  // D8 LOW -> relay coil ON -> NO closes -> motor runs
  isPumpActive   = true;
  pumpStartTime  = millis();
  Serial.println(F("[PUMP] ON  — D8=LOW, NO closed, motor circuit active."));
}

void stopPump() {
  pinMode(RELAY_PUMP_PIN, OUTPUT);
  digitalWrite(RELAY_PUMP_PIN, RELAY_OFF);  // D8 HIGH -> relay coil OFF -> NO open -> motor stops
  delay(20);
  digitalWrite(RELAY_PUMP_PIN, RELAY_OFF);  // second write for reliability
  isPumpActive = false;
  Serial.println(F("[PUMP] OFF — D8=HIGH, NO open, motor circuit broken."));
}

void stopPumpSafetyCutoff() {
  digitalWrite(RELAY_PUMP_PIN, RELAY_OFF);
  isPumpActive = false;
  Serial.println(F("[PUMP] SAFETY CUTOFF — 5-minute max runtime reached."));
}

// ===========================================================================
// PDLC cyclic state control
// ===========================================================================
int opacityToStateIndex(int opacity) {
  int nearest = 0;
  int minDiff = abs(opacity - PDLC_STATE_OPACITIES[0]);
  for (int i = 1; i < NUM_PDLC_STATES; i++) {
    int diff = abs(opacity - PDLC_STATE_OPACITIES[i]);
    if (diff < minDiff) { minDiff = diff; nearest = i; }
  }
  return nearest;
}

void setPDLCOpacity(int targetOpacity) {
  int targetIdx  = opacityToStateIndex(targetOpacity);
  int clicks     = (targetIdx - currentPdlcStateIndex + NUM_PDLC_STATES) % NUM_PDLC_STATES;

  Serial.print(F("[PDLC] "));
  Serial.print(PDLC_STATE_OPACITIES[currentPdlcStateIndex]);
  Serial.print(F("% -> "));
  Serial.print(PDLC_STATE_OPACITIES[targetIdx]);
  Serial.print(F("% | clicks="));
  Serial.println(clicks);

  if (clicks == 0) {
    Serial.println(F("[PDLC] Already at target. No action."));
    return;
  }

  for (int i = 0; i < clicks; i++) {
    digitalWrite(RELAY_PDLC_PIN, RELAY_ON);
    delay(200);
    digitalWrite(RELAY_PDLC_PIN, RELAY_OFF);
    delay(400);
  }

  currentPdlcStateIndex = targetIdx;
  Serial.print(F("[PDLC] Done. Now at state "));
  Serial.print(currentPdlcStateIndex);
  Serial.print(F(" ("));
  Serial.print(PDLC_STATE_OPACITIES[currentPdlcStateIndex]);
  Serial.println(F("%)"));
}
