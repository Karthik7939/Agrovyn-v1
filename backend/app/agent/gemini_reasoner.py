"""Optional Gemini reasoning layer for the greenhouse agent.

The physics + safety controllers remain authoritative. Gemini may explain
the plan and suggest adjustments; unsafe suggestions are discarded.
"""

from __future__ import annotations

import json
import os
import re
from typing import Optional

import requests

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


class GeminiReasoner:
    def __init__(self):
        # NOTE: api_key and enabled are intentionally read lazily via properties so
        # that load_dotenv() in main.py has already run before we check os.getenv.
        # Do NOT cache these values at __init__ time.
        pass

    @property
    def api_key(self) -> Optional[str]:
        return os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")

    @property
    def enabled(self) -> bool:
        return bool(self.api_key)

    @property
    def _model(self) -> str:
        return os.getenv("GEMINI_MODEL", "gemini-2.5-flash-lite")

    def reason(self, snapshot: dict) -> Optional[dict]:
        if not self.enabled:
            return None
        prompt = (
            "You are the autonomous supervisor of a smart greenhouse in Bangalore.\n"
            "You receive live sensors, a physics-hybrid forecast, and a proposed actuation plan.\n"
            "Return ONLY JSON with keys:\n"
            "  approve (boolean),\n"
            "  pump (ON or OFF),\n"
            "  pdlc_opacity (0, 33, 66, or 100),\n"
            "  rationale (short string),\n"
            "  risks (array of short strings).\n"
            "Rules: never irrigate if soil is already above 68%. Never command pumps during cooldown.\n"
            "At night (solar elevation <= 0) keep PDLC clear (0) unless a safety reason exists.\n"
            "Do not increase temperature forecasts; you do not control HVAC.\n\n"
            f"SNAPSHOT:\n{json.dumps(snapshot, default=str)[:4000]}"
        )
        url = GEMINI_URL.format(model=self._model) + f"?key={self.api_key}"
        try:
            res = requests.post(
                url,
                json={"contents": [{"parts": [{"text": prompt}]}]},
                timeout=6,
            )
            res.raise_for_status()
            text = res.json()["candidates"][0]["content"]["parts"][0]["text"]
            return self._parse_json(text)
        except Exception as e:
            print(f"[GeminiReasoner] skipped: {e}")
            return None

    @staticmethod
    def _parse_json(text: str) -> Optional[dict]:
        text = text.strip()
        match = re.search(r"\{[\s\S]*\}", text)
        if not match:
            return None
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            return None
