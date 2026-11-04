"""
AGROVYN – ESP8266 Sensor Simulator
===================================
Simulates the ESP8266 telemetry POST loop AND the hardware command poll loop
so you can test the full dashboard pipeline (including pump ON/OFF) without
physical hardware.

Usage:
    python backend/simulate_esp.py              # single one-shot POST
    python backend/simulate_esp.py --loop       # continuous 5-second loop (like real ESP)
    python backend/simulate_esp.py --loop --interval 10
"""

import argparse
import json
import math
import random
import time
import threading
from datetime import datetime

import urllib.request
import urllib.error

BASE_URL = "http://localhost:8000"
SENSOR_URL = f"{BASE_URL}/api/sensors"
POLL_URL   = f"{BASE_URL}/api/hardware/poll"
DEVICE_ID  = "greenhouse-esp8266-01"


# --------------------------------------------------------------------------- #
# Sensor reading generator                                                      #
# --------------------------------------------------------------------------- #

def make_reading(t: float = 0.0) -> dict:
    """Generate a realistic simulated sensor reading that slowly drifts."""
    base_temp = 27.5 + 3.0 * math.sin(2 * math.pi * t / 120)   # 2-min cycle
    base_hum  = 68.0 + 5.0 * math.cos(2 * math.pi * t / 180)
    base_soil = 38.0 + 10.0 * math.sin(2 * math.pi * t / 300)

    # Simulate ADS1015 raw values that match the calibrated percentages
    # SOIL_DRY=800, SOIL_WET=320  → raw = 800 - (pct/100)*(800-320)
    soil_pct = round(max(0.0, min(100.0, base_soil + random.uniform(-1, 1))), 1)
    soil_raw = int(800 - (soil_pct / 100.0) * (800 - 320))

    # LDR: map range 100–1800 → 0–100%
    ldr_pct  = round(max(0.0, min(100.0, 55.0 + random.uniform(-5, 5))), 1)
    ldr_raw  = int(100 + (ldr_pct / 100.0) * (1800 - 100))

    return {
        "device_id":            DEVICE_ID,
        "temperature":          round(base_temp + random.uniform(-0.2, 0.2), 1),
        "humidity":             round(max(0.0, min(100.0, base_hum + random.uniform(-0.5, 0.5))), 1),
        "soil_moisture_raw":    soil_raw,
        "soil_moisture_percent": soil_pct,
        "ldr_raw":              ldr_raw,
        "ldr_percent":          ldr_pct,
    }


# --------------------------------------------------------------------------- #
# HTTP helpers                                                                  #
# --------------------------------------------------------------------------- #

def post_reading(payload: dict) -> bool:
    body = json.dumps(payload).encode("utf-8")
    req  = urllib.request.Request(
        SENSOR_URL,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read())
            ts   = data.get("received", {}).get("timestamp", "?")
            temp = payload["temperature"]
            hum  = payload["humidity"]
            soil = payload["soil_moisture_percent"]
            ldr  = payload["ldr_percent"]
            print(
                f"[{datetime.now().strftime('%H:%M:%S')}] [SENSOR] "
                f"Temp={temp}C  Hum={hum}%  Soil={soil}%  LDR={ldr}%"
            )
            return True
    except urllib.error.HTTPError as e:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] [SENSOR] HTTP {e.code}: {e.read().decode()}")
    except Exception as e:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] [SENSOR] Connection error: {e}")
        print(f"    -> Is the FastAPI backend running at {BASE_URL}?")
    return False


def poll_hardware_commands() -> list:
    """
    Mimics the ESP8266 polling /api/hardware/poll every 1 second.
    Returns the list of commands received (for logging).
    When a real ESP is not connected, this is the ONLY way commands
    queued by the dashboard (PUMP:ON, PUMP:OFF, PDLC:xx) get consumed.
    """
    req = urllib.request.Request(POLL_URL, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=3) as resp:
            data = json.loads(resp.read())
            cmds = data.get("pending_commands", [])
            for c in cmds:
                cmd_str = c.get("command", "")
                ts_str  = c.get("timestamp", "")
                print(
                    f"[{datetime.now().strftime('%H:%M:%S')}] [ARDUINO] <<< {cmd_str}"
                    f"  (queued at {ts_str[-8:] if len(ts_str) >= 8 else ts_str})"
                )
                # Here a real ESP would send cmd_str over SoftwareSerial to Arduino
            return cmds
    except Exception:
        return []


# --------------------------------------------------------------------------- #
# Background command poller thread                                               #
# --------------------------------------------------------------------------- #

def command_poll_thread(stop_event: threading.Event):
    """Polls for hardware commands every 1 second (same interval as real ESP8266)."""
    while not stop_event.is_set():
        poll_hardware_commands()
        stop_event.wait(1.0)


# --------------------------------------------------------------------------- #
# Main                                                                          #
# --------------------------------------------------------------------------- #

def main():
    parser = argparse.ArgumentParser(description="AGROVYN ESP8266 Sensor Simulator")
    parser.add_argument("--loop",     action="store_true", help="Run continuously like real ESP")
    parser.add_argument("--interval", type=float, default=5.0, help="Sensor posting interval in seconds (default: 5)")
    args = parser.parse_args()

    print(f"AGROVYN Sensor Simulator -> {SENSOR_URL}")
    print(f"Device ID : {DEVICE_ID}")

    if args.loop:
        print(f"Mode      : Continuous loop — sensor every {args.interval}s, commands polled every 1s")
        print("            PUMP:ON / PUMP:OFF from dashboard will appear as [ARDUINO] <<< lines\n")

        stop_event = threading.Event()
        poller = threading.Thread(target=command_poll_thread, args=(stop_event,), daemon=True)
        poller.start()

        t = 0.0
        try:
            while True:
                payload = make_reading(t)
                post_reading(payload)
                t += args.interval
                time.sleep(args.interval)
        except KeyboardInterrupt:
            print("\nStopping simulator.")
            stop_event.set()
    else:
        print("Mode      : Single one-shot POST + command poll\n")
        payload = make_reading(0.0)
        ok = post_reading(payload)
        poll_hardware_commands()  # Drain any queued commands too
        if ok:
            print(f"\nDashboard should now show live data at http://localhost:3000/dashboard")
            print("   Run with --loop to keep it streaming (like real ESP8266).")


if __name__ == "__main__":
    main()
