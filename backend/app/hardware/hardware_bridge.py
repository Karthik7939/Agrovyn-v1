from datetime import datetime
from collections import deque

class HardwareBridge:
    _instance = None

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = HardwareBridge()
        return cls._instance

    def __init__(self):
        self.command_queue = deque()
        self.last_heartbeat = datetime.now()
        self.esp8266_status = 'online'
        self.arduino_status = 'connected'

    def queue_command(self, cmd: str) -> dict:
        timestamp = datetime.now().isoformat()
        item = {'command': cmd, 'timestamp': timestamp, 'status': 'queued'}
        self.command_queue.append(item)
        print(f"[HardwareBridge] Queued command: {cmd}")
        return item

    def get_pending_commands(self) -> list:
        pending = list(self.command_queue)
        self.command_queue.clear()
        return pending

    def peek_pending_count(self) -> int:
        """Non-destructive count — for status/health reporting only."""
        return len(self.command_queue)

    def update_heartbeat(self, device_id: str, status: str = 'online'):
        self.last_heartbeat = datetime.now()
        self.esp8266_status = status

    def is_device_online(self, timeout_seconds: int = 30) -> bool:
        elapsed = (datetime.now() - self.last_heartbeat).total_seconds()
        return elapsed <= timeout_seconds
