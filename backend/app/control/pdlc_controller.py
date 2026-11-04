class PDLCController:
    """
    PDLC Smart Glass Control Logic.

    Physical hardware has exactly 4 opacity states (cyclic, button-driven):
      State 0 =   0% opacity (Fully Transparent)
      State 1 =  33% opacity (Light Tint)
      State 2 =  66% opacity (Medium Tint)
      State 3 = 100% opacity (Fully Opaque)

    Only output these 4 values: 0, 33, 66, 100.
    Arduino handles click count calculation for cyclic state transitions.
    """
    VALID_STATES = [0, 33, 66, 100]

    def evaluate_opacity(self, current_ldr_pct: float, predicted_temp_120m: float) -> tuple[str, str, int]:
        is_high_light = current_ldr_pct > 65.0
        is_high_temp  = predicted_temp_120m > 30.0

        if current_ldr_pct > 80.0:
            target_opacity = 100
            decision = "MAXIMUM PDLC OPACITY"
            reason = f"Extreme solar irradiance ({current_ldr_pct:.0f}%) requires fully opaque State 3 (100%) to protect crops from heat stress."
        elif is_high_light and is_high_temp:
            target_opacity = 66
            decision = "INCREASE PDLC OPACITY"
            reason = f"High light ({current_ldr_pct:.0f}%) combined with predicted temperature ({predicted_temp_120m:.1f}°C) triggers medium tinting State 2 (66%) to mitigate microclimate overheating."
        elif current_ldr_pct > 40.0:
            target_opacity = 33
            decision = "PARTIAL TINT OPACITY"
            reason = f"Moderate solar light ({current_ldr_pct:.0f}%). Light tinting State 1 (33%) provides glare control while allowing adequate photosynthesis light."
        else:
            target_opacity = 0
            decision = "CLEAR PDLC OPACITY"
            reason = f"Low ambient solar radiation ({current_ldr_pct:.0f}%). Maintaining State 0 (0%) for maximum transparent solar gain and photosynthesis."

        return decision, reason, target_opacity
