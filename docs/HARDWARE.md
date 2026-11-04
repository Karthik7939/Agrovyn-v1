# AGROVYN — Hardware Architecture & Wiring Reference

> Complete hardware documentation for the AGROVYN Smart Adaptive Greenhouse system.  
> Last updated: October 2026

---

## System Overview

AGROVYN uses a **dual-microcontroller architecture** with an ESP8266 NodeMCU handling WiFi communication and sensor acquisition, and an Arduino Uno controlling physical actuators (pump relay and PDLC smart glass relay) via a SoftwareSerial UART bridge.

```
┌─────────────────────────────────────────────────────────────┐
│                    AGROVYN HARDWARE STACK                    │
│                                                             │
│  ┌──────────────┐    UART 9600     ┌──────────────────┐    │
│  │  ESP8266      │ ──────────────► │  Arduino Uno      │    │
│  │  NodeMCU      │  D7(TX)→Pin2    │                   │    │
│  │              │  D6(RX)←Pin3    │  Pin 7 → PDLC     │    │
│  │  Sensors:    │                 │  Pin 8 → Pump     │    │
│  │  • DHT11     │    WiFi         │                   │    │
│  │  • ADS1015   │ ◄──────────►   │  Relay Module x2  │    │
│  │  • Soil Cap  │  192.168.1.x    └──────────────────┘    │
│  │  • LDR       │                                          │
│  └──────────────┘                                          │
│         │                                                   │
│         ▼ HTTP POST / GET                                   │
│  ┌──────────────────┐                                      │
│  │  FastAPI Backend  │  ← Python on PC/Laptop              │
│  │  Port 8000        │                                      │
│  └──────────────────┘                                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Component Bill of Materials

| Component | Model | Quantity | Role |
|---|---|---|---|
| ESP8266 NodeMCU | ESP-12E (v1.0) | 1 | WiFi + sensor hub |
| Arduino Uno | ATmega328P | 1 | Actuator controller |
| DHT11 | — | 1 | Temperature & humidity |
| ADS1015 | 12-bit I2C ADC | 1 | Analog-to-digital for soil/LDR |
| Capacitive Soil Moisture Sensor | v1.2 | 1 | Soil moisture (analog) |
| LDR Sensor Module | Analog output | 1 | Light intensity (analog) |
| Relay Module (optocoupler) | 5V active-LOW | 2 | Pump relay + PDLC relay |
| PDLC Smart Glass Sheet | — | 1 | Variable opacity glazing |
| PDLC Controller | USB-C powered | 1 | Drives PDLC sheet |
| Water Pump | 12V DC | 1 | Irrigation |
| External 12V Power Supply | — | 1 | Pump power |

---

## Block 1: ESP8266 — Sensor Connections

### 1.1 DHT11 Temperature & Humidity Sensor

| DHT11 Pin | Connect To | Purpose |
|---|---|---|
| VCC | ESP8266 **3V3** | Power |
| GND | ESP8266 **GND** | Ground |
| DATA | ESP8266 **D5** (GPIO14) | Digital temperature/humidity signal |

### 1.2 ADS1015 External ADC Module (I2C)

The ESP8266 has no native analog input suitable for precision soil/light readings. The ADS1015 provides two 12-bit ADC channels over I2C.

| ADS1015 Pin | Connect To | Purpose |
|---|---|---|
| VDD | ESP8266 **3V3** | Power |
| GND | ESP8266 **GND** | Ground |
| SDA | ESP8266 **D2** (GPIO4) | I2C data |
| SCL | ESP8266 **D1** (GPIO5) | I2C clock |
| ADDR | ADS1015 **GND** (on the module itself) | Sets I2C address to `0x48` |
| ALRT | ❌ Not connected | — |

> **ADDR Pin**: Short the ADDR pin to GND *on the ADS1015 module itself* — not to the ESP8266. This sets the I2C address to `0x48`.

### 1.3 Capacitive Soil Moisture Sensor v1.2

| Soil Sensor Pin | Connect To | Purpose |
|---|---|---|
| VCC | ESP8266 **3V3** | Power |
| GND | ESP8266 **GND** | Ground |
| AOUT | ADS1015 **A0** | Soil moisture analog signal |

**Calibration values** (configured in ESP8266 firmware):
- `SOIL_DRY = 800` — raw ADC reading in open air (0% moisture)
- `SOIL_WET = 320` — raw ADC reading fully submerged in water (100% moisture)

### 1.4 Analog LDR Sensor Module

| LDR Pin | Connect To | Purpose |
|---|---|---|
| VCC | ESP8266 **3V3** (or Arduino 3V3) | Power |
| GND | ESP8266 **GND** (or Arduino GND) | Ground |
| AO / OUT | ADS1015 **A1** | Light intensity analog signal |

### 1.5 ESP8266 3V3 Power Distribution

The NodeMCU board has 3 × 3V3 pins and 3 × GND pins across both headers. Distribute sensors across them:

| Device | 3V3 Source |
|---|---|
| DHT11 | Right header 3V3 (near D8/D7) |
| ADS1015 | Left header 3V3 (near EN/RST) |
| Soil Sensor | Left header 3V3 (near VIN) |
| LDR | Any remaining 3V3 or Arduino 3V3 |

---

## Block 2: ESP8266 ↔ Arduino UART Bridge

The ESP8266 and Arduino communicate over **SoftwareSerial at 9600 baud**. The ESP sends actuator commands (`PUMP:ON`, `PUMP:OFF`, `PDLC:66`) received from the FastAPI backend, and the Arduino executes them on physical relay pins.

| ESP8266 Pin | Arduino Pin | Purpose |
|---|---|---|
| **D7** (Software TX) | **Pin 2** (Software RX) | ESP sends commands to Arduino |
| **D6** (Software RX) | **Pin 3** (Software TX) | Arduino sends responses to ESP |
| **GND** | **GND** | ⚠️ **Critical** — shared reference ground |

> **⚠️ WARNING**: Do NOT use the ESP8266's hardware `TX`/`RX` pins or the Arduino's Pin 0/Pin 1. Those are used for USB serial programming and will block firmware uploads.

### Command Protocol

Commands are plain ASCII strings terminated by `\n` (newline):

| Command | Effect |
|---|---|
| `PUMP:ON\n` | Arduino sets D8 LOW → relay coil energises → pump runs |
| `PUMP:OFF\n` | Arduino sets D8 HIGH → relay coil releases → pump stops |
| `PDLC:0\n` | Arduino pulses D7 relay to reach State 0 (transparent) |
| `PDLC:33\n` | State 1 — light tint |
| `PDLC:66\n` | State 2 — medium tint |
| `PDLC:100\n` | State 3 — fully opaque |

---

## Block 3: Arduino ↔ Actuators

### 3.1 Pump Motor Relay (Pin D8)

The pump relay is a standard **optocoupler relay module** (active-LOW: pulling IN to LOW energises the coil).

| Relay Pin | Connect To | Purpose |
|---|---|---|
| **VCC** | Arduino **5V** | Relay coil power |
| **GND** | Arduino **GND** | Ground |
| **IN** | Arduino **D8** | Control signal |
| **NO** (常开) | Motor red wire | Normally-Open contact |
| **COM** (公共端) | External PSU **+12V** | Common terminal |
| **NC** | ❌ Not connected | — |

**Current path when relay activates:**
```
External PSU (+12V) → COM → NO → Motor (+) → Motor (−) → PSU GND
```

**Relay logic:**
```
D8 = LOW  → Relay ON  → NO closes → Motor runs
D8 = HIGH → Relay OFF → NO opens  → Motor stops
```

> The motor's **negative wire** connects to the external power supply's **GND** (not shown in relay wiring — it's a separate connection completing the motor circuit).

### 3.2 PDLC Smart Glass Relay (Pin D7)

The PDLC controller has a physical button that cycles through 4 opacity states. The Arduino simulates button presses by briefly closing a relay contact wired across the button terminals.

| Relay Pin | Connect To | Purpose |
|---|---|---|
| **VCC** | Arduino **5V** | Relay coil power |
| **GND** | Arduino **GND** | Ground |
| **IN** | Arduino **D7** | Control signal |
| **COM** | PDLC Controller Button Wire A | Simulates button press |
| **NO** | PDLC Controller Button Wire B | — |

**PDLC 4-State Cyclic Model:**
```
State 0 →  0% opacity (Transparent)  ──press──►
State 1 → 33% opacity (Light Tint)   ──press──►
State 2 → 66% opacity (Medium Tint)  ──press──►
State 3 →100% opacity (Opaque)       ──press──► (wraps to State 0)
```

**Click calculation:**  
`clicks = (targetStateIndex − currentStateIndex + 4) % 4`

The Arduino tracks the current state in memory. Each relay pulse is 200ms ON + 400ms OFF to give the PDLC controller time to register.

> ⚠️ The PDLC controller is **completely electrically isolated** from the Arduino/ESP circuit. The relay contact only bridges the button terminals — no current flows between the two circuits.

---

## Block 4: Ground Network

All devices **must share a common ground reference** for the UART bridge and sensor signals to work.

| Device | GND Connects To |
|---|---|
| ESP8266 GND | Common reference point |
| DHT11 GND | ESP8266 GND |
| ADS1015 GND | ESP8266 GND |
| Soil Sensor GND | ESP8266 GND |
| LDR GND | ESP8266 GND |
| Arduino GND | ESP8266 GND (for UART bridge) |
| Relay Module GND (×2) | Arduino GND |
| PDLC Controller | ⛔ **Isolated** — do NOT connect to any GND above |

---

## Block 5: Data Flow Architecture

```
Every 5 seconds:
  ESP8266 reads DHT11 + ADS1015
    → POST /api/sensors (JSON payload)
    → FastAPI processes, runs ML prediction + agent cycle
    → Queues actuator commands if needed

Every 1 second:
  ESP8266 polls GET /api/hardware/poll
    → Receives pending commands (PUMP:ON, PDLC:66, etc.)
    → Sends each command over SoftwareSerial to Arduino
    → Arduino executes relay action
```

### Sensor POST Payload Format
```json
{
  "device_id": "greenhouse-esp8266-01",
  "temperature": 27.3,
  "humidity": 68.5,
  "soil_moisture_raw": 612,
  "soil_moisture_percent": 39.1,
  "ldr_raw": 1084,
  "ldr_percent": 57.9
}
```

---

## Block 6: Firmware Files

| Board | Firmware File | Baud Rate |
|---|---|---|
| ESP8266 NodeMCU | `firmware/esp8266/esp8266_agrovyn.ino` | 115200 (USB) + 9600 (SoftwareSerial) |
| Arduino Uno | `firmware/arduino/arduino_agrovyn.ino` | 115200 (USB) + 9600 (SoftwareSerial) |

### ESP8266 Configuration (in firmware)
```cpp
const char* ssid       = "YOUR_WIFI_SSID";       // Must be 2.4GHz
const char* password   = "YOUR_WIFI_PASSWORD";
const char* backend_url = "http://YOUR_PC_IP:8000/api/sensors";
const char* poll_url    = "http://YOUR_PC_IP:8000/api/hardware/poll";
```

### Arduino Safety Constants (in firmware)
```cpp
#define RELAY_ON  LOW          // Active-LOW optocoupler relay
#define RELAY_OFF HIGH
MAX_PUMP_RUNTIME_MS = 300000   // 5-minute hard safety cutoff
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| ESP prints `HTTP -1` | Can't reach backend | Check WiFi SSID, PC IP, firewall port 8000, `--host 0.0.0.0` |
| ESP prints dots forever | Wrong WiFi credentials | Verify SSID & password in firmware |
| Relay clicks but motor doesn't spin | Wiring or power issue | Check external PSU, NO/COM wiring |
| Relay doesn't click at all | Active-HIGH relay board | Change `RELAY_ON` to `HIGH` in Arduino firmware |
| `PUMP:ON` sent but nothing happens | Simulator stealing commands | Kill all `simulate_esp.py` processes |
| PDLC doesn't change state | Button wire contacts reversed | Swap COM ↔ NO wires on PDLC relay |
| Sensors read 0 / NaN | I2C not connected | Check ADS1015 SDA→D2, SCL→D1, ADDR→GND |
