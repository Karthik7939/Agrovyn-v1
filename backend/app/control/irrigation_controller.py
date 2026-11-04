class IrrigationController:
    def __init__(self, min_soil_pct: float = 38.0, max_soil_pct: float = 68.0):
        self.min_soil_pct = min_soil_pct
        self.max_soil_pct = max_soil_pct

    def evaluate_irrigation(self, current_soil: float, predicted_soil_120m: float) -> tuple[str, str, bool]:
        if predicted_soil_120m < self.min_soil_pct:
            decision = "IRRIGATION RECOMMENDED"
            reason = f"Predicted soil moisture ({predicted_soil_120m:.1f}%) is expected to fall below target threshold ({self.min_soil_pct:.1f}%)."
            recommend_pump_on = True
        elif current_soil < self.min_soil_pct:
            decision = "IRRIGATION RECOMMENDED"
            reason = f"Current soil moisture ({current_soil:.1f}%) is below configured lower limit ({self.min_soil_pct:.1f}%)."
            recommend_pump_on = True
        else:
            decision = "MOISTURE ADEQUATE"
            reason = f"Predicted soil moisture ({predicted_soil_120m:.1f}%) remains safely within range ({self.min_soil_pct:.1f}% - {self.max_soil_pct:.1f}%)."
            recommend_pump_on = False

        return decision, reason, recommend_pump_on
