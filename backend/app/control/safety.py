from datetime import datetime, timedelta

class SafetySystem:
    def __init__(self, max_pump_runtime_sec: int = 300, pump_cooldown_sec: int = 600):
        self.max_pump_runtime_sec = max_pump_runtime_sec
        self.pump_cooldown_sec = pump_cooldown_sec
        self.last_pump_off_time = None
        self.pump_start_time = None

    def validate_pump_start(self, current_pump_state: str) -> tuple[bool, str]:
        if current_pump_state == 'ON':
            return False, "Pump is already running."

        now = datetime.now()
        if self.last_pump_off_time:
            elapsed_cooldown = (now - self.last_pump_off_time).total_seconds()
            if elapsed_cooldown < self.pump_cooldown_sec:
                remaining = int(self.pump_cooldown_sec - elapsed_cooldown)
                return False, f"Pump safety cooldown active. Please wait {remaining} seconds."

        return True, "Safety check passed."

    def validate_pump_runtime(self, start_time_iso: str) -> bool:
        if not start_time_iso:
            return True
        try:
            start_dt = datetime.fromisoformat(start_time_iso)
            elapsed = (datetime.now() - start_dt).total_seconds()
            if elapsed >= self.max_pump_runtime_sec:
                return False # Exceeded max safety runtime
        except Exception:
            pass
        return True
