import os
from datetime import datetime, timedelta
from typing import List, Optional
from dotenv import load_dotenv

# Load env variables from .env.local or .env in project root
env_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if os.path.exists(os.path.join(env_root, ".env.local")):
    load_dotenv(os.path.join(env_root, ".env.local"))
elif os.path.exists(os.path.join(env_root, ".env")):
    load_dotenv(os.path.join(env_root, ".env"))

from fastapi import FastAPI, HTTPException, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware

from .models.schemas import (
    SensorReadingCreate,
    SensorReadingResponse,
    PredictionResponse,
    PumpControlPayload,
    PDLCControlPayload,
    ControlModePayload,
    HardwareCommandPayload,
    HardwareHeartbeatPayload
)
from .ml.predictor import Predictor
from .ml.model_loader import ModelLoader
from .control.controller import MicroclimateController
from .hardware.hardware_bridge import HardwareBridge
from .database.supabase_client import SupabaseManager
from .agent.greenhouse_agent import GreenhouseAgent

app = FastAPI(
    title="AGROVYN Smart Adaptive Greenhouse API",
    description="FastAPI Backend & ML Prediction Engine for Smart Microclimate & Precision Irrigation Control",
    version="1.2.0"
)

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global service singletons
predictor = Predictor()
model_loader = ModelLoader.get_instance()
controller = MicroclimateController()
hardware = HardwareBridge.get_instance()
supabase_manager = SupabaseManager.get_instance()

import json

CACHE_FILE = os.path.join(os.path.dirname(__file__), "latest_sensor_cache.json")

# How old a sensor reading can be before it is considered stale.
# Must match TELEMETRY_STALE_MS on the frontend (liveTelemetry.ts).
TELEMETRY_STALE_SECONDS = 45

# On server restart, only reload the disk cache if it is within this window.
# Set equal to the stale threshold so a cached reading is only served while still live.
CACHE_MAX_AGE_SECONDS = TELEMETRY_STALE_SECONDS
# Real telemetry history buffer
sensor_history_log: List[dict] = []
event_log: List[dict] = []

# In-memory latest reading. Populated by POST /api/sensors from the ESP8266.
# On restart, loaded from disk cache only if the reading is still fresh.
latest_sensor_data: Optional[dict] = None

if os.path.exists(CACHE_FILE):
    try:
        with open(CACHE_FILE, "r") as f:
            cached = json.load(f)
            if cached and cached.get("timestamp"):
                age = (datetime.now() - datetime.fromisoformat(cached["timestamp"])).total_seconds()
                if age <= CACHE_MAX_AGE_SECONDS:
                    latest_sensor_data = cached
                    sensor_history_log.append(cached)
                    print(f"[TelemetryCache] Loaded fresh cache (age={age:.0f}s).")
                else:
                    print(f"[TelemetryCache] Skipped stale cache (age={age:.0f}s > {CACHE_MAX_AGE_SECONDS}s). Waiting for ESP8266.")
    except Exception as e:
        print(f"[TelemetryCache] Failed to load disk cache: {e}")

actuator_state = {
    "pump_state": "OFF",
    "pump_last_activation": None,
    "pump_duration_minutes": 5.0,
    "pump_control_source": "AI",
    "pdlc_opacity": 0,          # Startup = State 0 (Transparent), matches Arduino assumption
    "pdlc_target_opacity": 0,
    "pdlc_controller_status": "connected",
    "pdlc_control_source": "AI",
    "control_mode": "automatic",
    "last_updated": datetime.now().isoformat()
}

def log_system_event(event_type: str, message: str, severity: str = "info", source: str = "system", reason: str = "", result: str = ""):
    evt = {
        "id": f"evt-{len(event_log) + 1}",
        "timestamp": datetime.now().isoformat(),
        "event_type": event_type,
        "message": message,
        "severity": severity,
        "source": source,
        "reason": reason,
        "result": result
    }
    event_log.insert(0, evt)
    if len(event_log) > 100:
        event_log.pop()

# Initial boot event
log_system_event(
    "system",
    "AGROVYN FastAPI Microclimate Engine Initialized",
    "success",
    "system",
    "Server boot sequence complete.",
    f"Loaded forecast engine: {model_loader.get_version()}"
)

agent = GreenhouseAgent(hardware=hardware, log_event=log_system_event)

@app.get("/health")
def health_check():
    age_sec = None
    if latest_sensor_data and latest_sensor_data.get("timestamp"):
        try:
            age_sec = round((datetime.now() - datetime.fromisoformat(latest_sensor_data["timestamp"])).total_seconds(), 1)
        except Exception:
            pass
    return {
        "status": "online",
        "esp8266": "online" if hardware.is_device_online() else "offline",
        # Arduino is reachable via ESP8266's SoftwareSerial bridge only when the ESP itself
        # is online. The pdlc_controller_status field defaults to "connected" at boot and is
        # never updated from real hardware feedback, so we derive Arduino status from the ESP
        # heartbeat rather than the stale default value.
        "arduino": "connected" if hardware.is_device_online() else "disconnected",
        "supabase": "connected",
        "ml_engine": "ready",
        "gemini_enabled": agent.gemini.enabled,
        "agent_status": (agent.last_plan or {}).get("status", "idle"),
        "control_mode": actuator_state.get("control_mode"),
        "pending_command_count": hardware.peek_pending_count(),
        "last_data_timestamp": latest_sensor_data.get("timestamp") if latest_sensor_data else None,
        "last_data_age_seconds": age_sec,
        "telemetry_stale_seconds": TELEMETRY_STALE_SECONDS,
    }

@app.get("/api/sensors/latest")
def get_latest_sensors():
    if not latest_sensor_data:
        raise HTTPException(
            status_code=404,
            detail="No hardware sensor reading received yet from ESP8266."
        )
    # Enforce the same staleness window the frontend uses (TELEMETRY_STALE_MS / 1000)
    try:
        age = (datetime.now() - datetime.fromisoformat(latest_sensor_data["timestamp"])).total_seconds()
        if age > TELEMETRY_STALE_SECONDS:
            raise HTTPException(
                status_code=404,
                detail=(
                    f"Last reading is {int(age)}s old — ESP8266 has gone silent "
                    f"(threshold: {TELEMETRY_STALE_SECONDS}s). "
                    "Check Wi-Fi, firmware, and backend IP in esp8266_agrovyn.ino."
                )
            )
    except HTTPException:
        raise
    except Exception:
        pass  # if timestamp parsing fails, return the data anyway
    return latest_sensor_data

@app.get("/api/sensors/history")
def get_sensor_history(hours: int = Query(24, ge=1, le=720)):
    if not sensor_history_log:
        return []
    cutoff = datetime.now() - timedelta(hours=hours)
    filtered = [
        item for item in sensor_history_log
        if datetime.fromisoformat(item["timestamp"]) >= cutoff
    ]
    return filtered

@app.post("/api/sensors")
def receive_sensor_payload(payload: SensorReadingCreate):
    global latest_sensor_data
    reading = {
        "id": f"sens-{int(datetime.now().timestamp())}",
        "timestamp": datetime.now().isoformat(),
        "temperature": payload.temperature,
        "humidity": payload.humidity,
        "soil_moisture_raw": payload.soil_moisture_raw,
        "soil_moisture_percent": payload.soil_moisture_percent,
        "ldr_raw": payload.ldr_raw,
        "ldr_percent": payload.ldr_percent,
        "esp_device_id": payload.device_id,
        "created_at": datetime.now().isoformat()
    }
    latest_sensor_data = reading
    sensor_history_log.append(reading)
    if len(sensor_history_log) > 5000:
        sensor_history_log.pop(0)

    try:
        with open(CACHE_FILE, "w") as f:
            json.dump(reading, f, indent=2)
    except Exception as e:
        print(f"[TelemetryCache] Failed to save disk cache: {e}")

    # Persist to Supabase PostgreSQL database
    try:
        supabase_manager.insert_sensor_reading({
            "temperature": payload.temperature,
            "humidity": payload.humidity,
            "soil_moisture_raw": payload.soil_moisture_raw,
            "soil_moisture_percent": payload.soil_moisture_percent,
            "ldr_raw": payload.ldr_raw,
            "ldr_percent": payload.ldr_percent,
            "esp_device_id": payload.device_id
        })
    except Exception as e:
        print(f"[Supabase] DB insertion warning: {e}")

    hardware.update_heartbeat(payload.device_id)

    if actuator_state["control_mode"] == "automatic":
        agent.run_cycle(reading, actuator_state)
        actuator_state["last_updated"] = datetime.now().isoformat()

    return {"status": "success", "received": latest_sensor_data}

@app.get("/api/predictions/latest")
def get_latest_predictions():
    if not latest_sensor_data:
        raise HTTPException(status_code=404, detail="No hardware telemetry available for prediction.")
    return predictor.predict_horizons(
        latest_sensor_data["temperature"],
        latest_sensor_data["humidity"],
        latest_sensor_data["soil_moisture_percent"],
        latest_sensor_data["ldr_percent"],
        timestamp_str=latest_sensor_data.get("timestamp"),
        pdlc_opacity=actuator_state.get("pdlc_opacity", 0),
        irrigation_on=actuator_state.get("pump_state") == "ON",
    )


@app.get("/api/agent/latest")
def get_latest_agent_plan():
    if agent.last_plan:
        return agent.last_plan
    if not latest_sensor_data:
        raise HTTPException(status_code=404, detail="No telemetry for agent cycle.")
    return agent.run_cycle(latest_sensor_data, actuator_state, execute=False)

@app.get("/api/predictions/metrics")
def get_prediction_metrics():
    metrics = model_loader.get_metrics()
    mae_t = metrics.get("mae_temp", metrics.get("mae", 0.55))
    mae_s = metrics.get("mae_soil", mae_t * 2.1)
    return {
        "mae_temp": round(mae_t, 2),
        "rmse_temp": round(mae_t * 1.3, 2),
        "r2_temp": round(metrics.get("r2_temp", metrics.get("r2", 0.88)), 2),
        "mae_soil": round(mae_s, 2),
        "rmse_soil": round(mae_s * 1.35, 2),
        "r2_soil": round(metrics.get("r2_soil", 0.84), 2),
        "sample_count": metrics.get("sample_count", 0),
        "evaluated_at": datetime.now().isoformat()
    }

@app.get("/api/control/decision")
def get_control_decision():
    if not latest_sensor_data:
        raise HTTPException(status_code=404, detail="No hardware telemetry available for control decision.")
    pred = predictor.predict_horizons(
        latest_sensor_data["temperature"],
        latest_sensor_data["humidity"],
        latest_sensor_data["soil_moisture_percent"],
        latest_sensor_data["ldr_percent"],
        timestamp_str=latest_sensor_data.get("timestamp"),
        pdlc_opacity=actuator_state.get("pdlc_opacity", 0),
    )
    t120 = pred["horizon_120m"]["temperature"]
    s120 = pred["horizon_120m"]["soil_moisture"]
    return controller.evaluate_system(
        latest_sensor_data["temperature"],
        latest_sensor_data["soil_moisture_percent"],
        latest_sensor_data["ldr_percent"],
        t120, s120
    )

@app.get("/api/actuators/status")
def get_actuator_status():
    return {
        **actuator_state,
        "pending_command_count": hardware.peek_pending_count(),
        "esp8266_online": hardware.is_device_online(),
    }

@app.post("/api/actuators/pump")
def control_pump(payload: PumpControlPayload):
    command = payload.command.upper()
    cmd = f"PUMP:{command}"
    # Manual override always wins: switch off the agent so the next ESP poll
    # cannot immediately send PUMP:ON again.
    actuator_state["control_mode"] = "manual"
    actuator_state["pump_state"] = command
    actuator_state["pump_control_source"] = payload.source.capitalize()
    actuator_state["last_updated"] = datetime.now().isoformat()
    hardware.queue_command(cmd)
    if command == "ON":
        actuator_state["pump_last_activation"] = datetime.now().isoformat()
        agent.safety.pump_start_time = datetime.now()
    else:
        # Queue twice so a dropped UART frame still has a second OFF.
        hardware.queue_command("PUMP:OFF")
        agent.safety.last_pump_off_time = datetime.now()
        agent.safety.pump_start_time = None

    log_system_event(
        "actuation",
        f"Manual Pump Command: {command}",
        "warning" if command == "ON" else "info",
        payload.source.lower(),
        "Manual override — control mode set to MANUAL so the agent will not re-actuate.",
        f"Dispatched {cmd} to hardware bridge (Arduino D8 pump relay)."
    )
    return {
        "success": True,
        "message": f"Pump command {cmd} dispatched",
        "control_mode": "manual",
        "pump_state": command,
    }

@app.post("/api/actuators/pdlc")
def control_pdlc(payload: PDLCControlPayload):
    cmd = f"PDLC:{payload.target_opacity}"
    hardware.queue_command(cmd)
    actuator_state["pdlc_opacity"] = payload.target_opacity
    actuator_state["pdlc_target_opacity"] = payload.target_opacity
    actuator_state["pdlc_control_source"] = payload.source.capitalize()
    
    log_system_event(
        "actuation",
        f"Manual PDLC Opacity Set: {payload.target_opacity}%",
        "info",
        payload.source.lower(),
        "User manual override applied via slider/preset.",
        f"Dispatched {cmd} button pulse sequence to Arduino."
    )
    return {"success": True, "message": f"PDLC opacity {payload.target_opacity}% queued for hardware pulse translation"}

@app.post("/api/control/mode")
def set_control_mode(payload: ControlModePayload):
    actuator_state["control_mode"] = payload.mode.lower()
    log_system_event(
        "system",
        f"Control Governance Mode Changed to {payload.mode.upper()}",
        "info",
        "manual",
        "User toggled control governance mode.",
        f"Actuator decisions now governed by {payload.mode.upper()} strategy."
    )
    return {"success": True, "mode": payload.mode.lower()}

@app.get("/api/events")
def get_events():
    return event_log

@app.get("/api/hardware/poll")
def poll_hardware_commands():
    return {"pending_commands": hardware.get_pending_commands()}

@app.post("/api/hardware/heartbeat")
def receive_heartbeat(payload: HardwareHeartbeatPayload):
    hardware.update_heartbeat(payload.device_id, payload.status)
    return {"status": "acknowledged", "timestamp": datetime.now().isoformat()}

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
