"""Autonomous greenhouse agent.

Loop: observe -> forecast -> propose (rules + safety) -> optional Gemini review -> actuate.
Hardware commands still go through SafetySystem; Gemini cannot bypass cooldowns.
"""

from __future__ import annotations

from datetime import datetime
from typing import Callable, Optional

from ..ml.predictor import Predictor
from ..control.controller import MicroclimateController
from ..control.safety import SafetySystem
from .gemini_reasoner import GeminiReasoner

PDLC_STATES = (0, 33, 66, 100)


class GreenhouseAgent:
    def __init__(self, hardware, log_event: Callable):
        self.hardware = hardware
        self.log_event = log_event
        self.predictor = Predictor()
        self.controller = MicroclimateController()
        self.safety = SafetySystem()
        self.gemini = GeminiReasoner()
        self.last_plan: Optional[dict] = None

    def run_cycle(self, reading: dict, actuator_state: dict, execute: bool = True) -> dict:
        pred = self.predictor.predict_horizons(
            reading["temperature"],
            reading["humidity"],
            reading["soil_moisture_percent"],
            reading["ldr_percent"],
            timestamp_str=reading.get("timestamp"),
            pdlc_opacity=actuator_state.get("pdlc_opacity", 0),
            irrigation_on=actuator_state.get("pump_state") == "ON",
        )
        t120 = pred["horizon_120m"]["temperature"]
        s120 = pred["horizon_120m"]["soil_moisture"]
        decision = self.controller.evaluate_system(
            reading["temperature"],
            reading["soil_moisture_percent"],
            reading["ldr_percent"],
            t120,
            s120,
        )

        diagnostics = pred.get("diagnostics") or {}
        is_night = float(diagnostics.get("solar_elevation_deg", 0) or 0) <= 0
        if is_night and decision["pdlc"]["target_opacity"] != 0:
            decision["pdlc"]["target_opacity"] = 0
            decision["pdlc"]["decision"] = "CLEAR PDLC OPACITY"
            decision["pdlc"]["reason"] = (
                "Night / post-sunset: keeping PDLC clear so residual light and morning "
                "photosynthesis are not blocked."
            )

        proposed_pump = "ON" if decision["soil"]["pump_recommended"] else "OFF"
        proposed_pdlc = decision["pdlc"]["target_opacity"]

        snapshot = {
            "sensors": {
                "temperature": reading["temperature"],
                "humidity": reading["humidity"],
                "soil_moisture_percent": reading["soil_moisture_percent"],
                "ldr_percent": reading["ldr_percent"],
                "timestamp": reading.get("timestamp"),
            },
            "forecast": {
                "30m": pred["horizon_30m"],
                "60m": pred["horizon_60m"],
                "120m": pred["horizon_120m"],
                "diagnostics": diagnostics,
            },
            "proposed": {
                "pump": proposed_pump,
                "pdlc_opacity": proposed_pdlc,
                "irrigation_reason": decision["soil"]["reason"],
                "pdlc_reason": decision["pdlc"]["reason"],
            },
            "actuators": {
                "pump_state": actuator_state.get("pump_state"),
                "pdlc_opacity": actuator_state.get("pdlc_opacity"),
                "control_mode": actuator_state.get("control_mode"),
            },
        }

        gemini_note = None
        gemini_approve = None
        gemini_risks: list = []
        if self.gemini.enabled:
            llm = self.gemini.reason(snapshot)
            if llm:
                gemini_note = llm.get("rationale")
                gemini_approve = llm.get("approve")
                raw_risks = llm.get("risks") or []
                if isinstance(raw_risks, list):
                    gemini_risks = [str(r) for r in raw_risks if r][:8]
                elif isinstance(raw_risks, str) and raw_risks.strip():
                    gemini_risks = [raw_risks.strip()]

                # approve=False keeps the rules plan; Gemini may only adjust when approved
                if gemini_approve is False:
                    gemini_note = (
                        (gemini_note or "Gemini withheld approval.")
                        + " Rules controller retained."
                    )
                else:
                    pump_s = str(llm.get("pump") or proposed_pump).upper()
                    if pump_s in ("ON", "OFF"):
                        # Gemini may only turn the pump OFF extra-conservatively,
                        # never force ON against soil rules
                        if pump_s == "OFF":
                            proposed_pump = "OFF"
                            decision["soil"]["pump_recommended"] = False
                    pdlc_s = llm.get("pdlc_opacity")
                    if pdlc_s in PDLC_STATES:
                        if is_night:
                            proposed_pdlc = 0
                        else:
                            proposed_pdlc = int(pdlc_s)
                            decision["pdlc"]["target_opacity"] = proposed_pdlc

        actions = []
        if execute and actuator_state.get("control_mode") == "automatic":
            actions.extend(self._apply_pump(proposed_pump, actuator_state, decision))
            actions.extend(self._apply_pdlc(proposed_pdlc, actuator_state, decision))

        plan = {
            "timestamp": datetime.now().isoformat(),
            "agent": "GreenhouseAgent",
            "gemini_enabled": self.gemini.enabled,
            "gemini_approve": gemini_approve,
            "gemini_rationale": gemini_note,
            "gemini_risks": gemini_risks,
            "proposed": {
                "pump": proposed_pump,
                "pdlc_opacity": proposed_pdlc,
            },
            "prediction": pred,
            "decision": decision,
            "actions": actions,
            "status": "executed" if actions else "observing",
        }
        self.last_plan = plan
        return plan

    def _apply_pump(self, proposed_pump: str, actuator_state: dict, decision: dict) -> list:
        actions = []
        current = actuator_state.get("pump_state", "OFF")
        if proposed_pump == "ON" and current == "OFF":
            ok, reason = self.safety.validate_pump_start(current)
            if not ok:
                self.log_event("safety", "Pump start blocked", "warning", "system", reason, "No actuation.")
                return actions
            self.hardware.queue_command("PUMP:ON")
            actuator_state["pump_state"] = "ON"
            actuator_state["pump_control_source"] = "AI"
            actuator_state["pump_last_activation"] = datetime.now().isoformat()
            self.safety.pump_start_time = datetime.now()
            msg = "Irrigation pump activated by greenhouse agent"
            self.log_event("actuation", msg, "warning", "ai", decision["soil"]["reason"], "Dispatched PUMP:ON")
            actions.append({"actuator": "pump", "command": "ON", "reason": decision["soil"]["reason"]})
        elif proposed_pump == "OFF" and current == "ON":
            last = actuator_state.get("pump_last_activation")
            still_needed = decision["soil"]["pump_recommended"]
            overtime = last and not self.safety.validate_pump_runtime(last)
            if overtime or not still_needed:
                self.hardware.queue_command("PUMP:OFF")
                actuator_state["pump_state"] = "OFF"
                self.safety.last_pump_off_time = datetime.now()
                why = "Max pump runtime reached" if overtime else "Soil moisture trajectory recovered"
                self.log_event("actuation", "Irrigation pump stopped", "info", "ai", why, "Dispatched PUMP:OFF")
                actions.append({"actuator": "pump", "command": "OFF", "reason": why})
        elif current == "ON":
            last = actuator_state.get("pump_last_activation")
            if last and not self.safety.validate_pump_runtime(last):
                self.hardware.queue_command("PUMP:OFF")
                actuator_state["pump_state"] = "OFF"
                self.safety.last_pump_off_time = datetime.now()
                self.log_event(
                    "safety",
                    "Pump forced OFF (max runtime)",
                    "critical",
                    "system",
                    "Safety cutoff 300s",
                    "Dispatched PUMP:OFF",
                )
                actions.append({"actuator": "pump", "command": "OFF", "reason": "safety max runtime"})
        return actions

    def _apply_pdlc(self, target: int, actuator_state: dict, decision: dict) -> list:
        actions = []
        if target not in PDLC_STATES:
            target = min(PDLC_STATES, key=lambda s: abs(s - int(target)))
        if target != actuator_state.get("pdlc_opacity"):
            self.hardware.queue_command(f"PDLC:{target}")
            actuator_state["pdlc_opacity"] = target
            actuator_state["pdlc_target_opacity"] = target
            actuator_state["pdlc_control_source"] = "AI"
            self.log_event(
                "actuation",
                f"PDLC opacity adjusted to {target}%",
                "info",
                "ai",
                decision["pdlc"]["reason"],
                f"Dispatched PDLC:{target}",
            )
            actions.append({"actuator": "pdlc", "command": target, "reason": decision["pdlc"]["reason"]})
        return actions
