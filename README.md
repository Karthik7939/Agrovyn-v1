# AGROVYN: Smart Adaptive Greenhouse Dashboard

**AI/ML-Driven Predictive Microclimate & Precision Irrigation Control System Using PDLC Glazing**

---

## 🌿 System Overview

AGROVYN is an industrial-grade, AI/ML-driven microclimate forecasting and precision irrigation platform designed for physical smart greenhouse environments. The system continuously monitors environmental variables (temperature, humidity, capacitive soil moisture, solar light intensity), runs multi-horizon predictions (+30m, +60m, +120m) using trained scikit-learn models, evaluates explainable control rules, and automatically actuates precision irrigation pumps and PDLC smart glass glazing.

---

## 🏛️ Physical Hardware & Communication Architecture

```
[ DHT11 Sensor ] ──┐
[ ADS1015 ADC  ] ──┼──> [ ESP8266 NodeMCU ] ──(Wi-Fi REST / JSON)──> [ Python FastAPI Backend ]
  ├─ A0: Soil      │             │                                           │
  └─ A1: LDR Light ┘             │ (Serial UART Baud 115200)                 ├──> [ Supabase PostgreSQL DB ]
                                 ▼                                           ├──> [ scikit-learn ML Engine ]
                          [ Arduino Uno ]                                    └──> [ Next.js Web Console ]
                            ├── Pin D7: PDLC Controller Pulse Relay
                            └── Pin D8: Irrigation Pump Relay (IN; COM=+PSU, NO=motor+)
```

---

## 🛠️ Technology Stack

- **Frontend**: Next.js (App Router), TypeScript, Tailwind CSS (Clean Light Green Agri-Tech Theme), Lucide Icons, Recharts
- **Backend API**: Python FastAPI, Pydantic v2, Uvicorn
- **Machine Learning**: scikit-learn (`RandomForestRegressor`, `MultiOutputRegressor`), pandas, numpy, joblib
- **Database**: Supabase PostgreSQL (Persistent telemetry, forecasts, audit logs, settings)
- **Hardware Firmware**: NodeMCU ESP8266 C++ Sketch, Arduino Uno Actuator C++ Sketch

---

## 🚀 Getting Started & Execution Guide

### 1. Frontend Web Dashboard
```bash
# Install dependencies
npm install

# Start development server
npm run dev
# Dashboard accessible at: http://localhost:3000/dashboard
```

### 2. Python FastAPI Backend & ML Server
```bash
# Install Python requirements
pip install -r backend/requirements.txt

# Train the ML model (Supports default synthetic baseline or your custom CSV!)
python backend/train_model.py

# Start FastAPI backend server
python -m uvicorn backend.app.main:app --reload --port 8000
# API documentation available at: http://localhost:8000/docs
```

---

## 📊 Training with Your Own Dataset

To train the machine learning model using your own physical greenhouse dataset:

1. Place your CSV dataset file in `backend/data/dataset.csv` or specify the path explicitly:
```bash
python backend/train_model.py --data path/to/your_dataset.csv
```

2. **Expected CSV Column Format** (Flexible column aliases supported):
   - `temperature` (or `temp`)
   - `humidity` (or `hum`)
   - `soil_moisture` (or `soil_moisture_percent`)
   - `light` (or `ldr_percent`)
   - `timestamp` (optional, formatted ISO 8601 or hour column)

The training script automatically generates sin/cos diurnal features, trains multi-step regressors for +30m, +60m, and +120m horizons, and exports the serialized model to `backend/models/greenhouse_model.pkl`.

---

## 📁 Repository Structure

```
├── backend/
│   ├── app/
│   │   ├── agent/           # GreenhouseAgent + optional Gemini supervisor
│   │   ├── control/         # Microclimate control logic & explainability
│   │   ├── database/        # Supabase database integration
│   │   ├── hardware/        # Hardware command queue & heartbeat bridge
│   │   ├── ml/              # Physics-hybrid predictor + residual ML
│   │   ├── models/          # Pydantic schema definitions
│   │   └── main.py          # FastAPI routes & application entrypoint
│   ├── data/                # Dataset folder (Place your dataset.csv here)
│   ├── models/              # Serialized .pkl ML model artifacts
│   ├── train_model.py       # Custom dataset training script
│   └── requirements.txt     # Python pip dependencies
├── firmware/
│   ├── esp8266/             # ESP8266 NodeMCU Wi-Fi telemetry firmware
│   └── arduino/             # Arduino Uno UART relay actuator firmware
├── src/
│   ├── app/                 # Next.js App Router pages (/dashboard, /predictions, /control, /sensors, /history, /settings)
│   ├── components/          # Reusable agri-tech UI components & cards
│   ├── lib/                 # API client, Supabase client, mock data generator
│   └── types/               # TypeScript interface definitions
├── supabase/
│   └── schema.sql           # Complete Supabase PostgreSQL schema script
└── package.json
```

---

## 🤖 Autonomous Agent & Optional Gemini

On each ESP8266 sensor POST (when control mode is `automatic`), `GreenhouseAgent` runs:

**observe → physics-hybrid forecast → safety rules → optional Gemini review → actuate**

- Physics + safety controllers remain authoritative (pump cooldown, max runtime, night PDLC clear).
- Set `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) in `.env` / `.env.local` to enable the language-model supervisor.
- Optional: `GEMINI_MODEL` (default `gemini-2.0-flash`).
- Gemini may only turn irrigation **OFF** conservatively or adjust daytime PDLC; `approve: false` discards its actuator suggestions.
- Latest plan: `GET /api/agent/latest` (also shown on the dashboard Autonomous agent panel).

Full loop, Gemini authority, APIs, and safety: [docs/greenhouse-agent.md](docs/greenhouse-agent.md).

---

## 🛡️ Safety & Autonomous Fail-Safes

- **Pump Max Runtime Limit**: 300 seconds hard safety cutoff.
- **Pump Cooldown Period**: 600 seconds safety delay before re-activation.
- **Fail-Safe Relay State**: Active LOW relays open (OFF) by default if connection drops.
- **Explainable AI Matrix**: Every actuation decision provides clear parameter justification.
- **Gemini cannot bypass** pump cooldown, max runtime, or night PDLC clear rules.
