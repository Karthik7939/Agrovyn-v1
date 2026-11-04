from datetime import datetime
from .irrigation_controller import IrrigationController
from .pdlc_controller import PDLCController
from .safety import SafetySystem

class MicroclimateController:
    def __init__(self):
        self.irrigation = IrrigationController(min_soil_pct=38.0, max_soil_pct=68.0)
        self.pdlc = PDLCController()
        self.safety = SafetySystem()

    def evaluate_system(self, temp: float, soil: float, ldr_pct: float, pred_temp_120m: float, pred_soil_120m: float) -> dict:
        soil_decision, soil_reason, pump_recommended = self.irrigation.evaluate_irrigation(soil, pred_soil_120m)
        pdlc_decision, pdlc_reason, target_opacity = self.pdlc.evaluate_opacity(ldr_pct, pred_temp_120m)

        ldr_label = "High" if ldr_pct > 70 else "Medium" if ldr_pct > 35 else "Low"

        return {
            "soil": {
                "current": soil,
                "predicted_120m": pred_soil_120m,
                "desired_min": 38.0,
                "desired_max": 68.0,
                "decision": soil_decision,
                "reason": soil_reason,
                "pump_recommended": pump_recommended
            },
            "pdlc": {
                "current_light": ldr_label,
                "current_light_percent": ldr_pct,
                "predicted_temp_120m": pred_temp_120m,
                "target_opacity": target_opacity,
                "decision": pdlc_decision,
                "reason": pdlc_reason
            },
            "timestamp": datetime.now().isoformat()
        }
