import os
import time
from supabase import create_client, Client

class SupabaseManager:
    _instance = None
    client: Client = None

    # Suppress repeated DNS/network error spam — log once, then every 5 minutes
    _last_error_log_time: float = 0
    _error_suppress_interval: float = 300  # seconds

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = SupabaseManager()
        return cls._instance

    def __init__(self):
        url = os.getenv('SUPABASE_URL', 'https://example-project.supabase.co')
        key = os.getenv('SUPABASE_KEY', 'example-service-key')
        try:
            self.client = create_client(url, key)
            print("[SupabaseManager] Supabase client initialized.")
        except Exception as e:
            print(f"[SupabaseManager] Initialization warning: {e}")
            self.client = None

    def _log_error_throttled(self, context: str, error: Exception):
        """Log an error at most once per _error_suppress_interval seconds."""
        now = time.time()
        if now - self._last_error_log_time >= self._error_suppress_interval:
            self._last_error_log_time = now
            print(f"[SupabaseManager] {context}: {error}  (suppressing repeats for 5 min)")

    def insert_sensor_reading(self, payload: dict):
        if self.client:
            try:
                return self.client.table('sensor_readings').insert(payload).execute()
            except Exception as e:
                self._log_error_throttled("Error inserting sensor reading", e)
        return None

    def insert_actuator_command(self, payload: dict):
        if self.client:
            try:
                return self.client.table('actuator_commands').insert(payload).execute()
            except Exception as e:
                self._log_error_throttled("Error inserting actuator command", e)
        return None
