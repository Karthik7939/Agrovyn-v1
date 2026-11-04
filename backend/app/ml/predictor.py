from datetime import datetime
from typing import Optional

import numpy as np

from .model_loader import ModelLoader
from .feature_engineering import FeatureEngineering, FEATURE_NAMES
from .physics_model import GreenhousePhysics, parse_timestamp

HORIZONS = (30, 60, 120)
RESIDUAL_CLIPS = {
    "temperature": 1.2,
    "humidity": 4.0,
    "soil_moisture": 3.5,
    "light": 8.0,
}


class Predictor:
    def __init__(self):
        self.loader = ModelLoader.get_instance()
        self.physics = GreenhousePhysics()

    def predict_horizons(
        self,
        temperature: float,
        humidity: float,
        soil_moisture: float,
        light: float,
        timestamp_str: Optional[str] = None,
        pdlc_opacity: float = 0.0,
        irrigation_on: bool = False,
    ) -> dict:
        dt = parse_timestamp(timestamp_str)
        if timestamp_str and abs((datetime.now() - dt).total_seconds()) > 20 * 60:
            # Stale telemetry: keep sensor values, but gear solar geometry to now
            dt = datetime.now()
        current = {
            "temperature": float(temperature),
            "humidity": float(humidity),
            "soil_moisture": float(soil_moisture),
            "light": float(light),
        }

        physics_fc = self.physics.rollout(
            temperature,
            humidity,
            soil_moisture,
            light,
            timestamp_str=dt.isoformat(),
            horizons_min=HORIZONS,
            pdlc_opacity=pdlc_opacity,
            irrigation_on=False,  # open-loop: do not assume pump stays on
        )

        residuals = self._residual_correction(current, timestamp_str=dt.isoformat())

        horizons = {}
        for h in HORIZONS:
            base = dict(physics_fc[h])
            if residuals is not None:
                try:
                    scale = h / 30.0
                    if len(residuals) == 6:
                        # 6-target model: [temp_30m, soil_30m, temp_60m, soil_60m, temp_120m, soil_120m]
                        h_idx = {30: 0, 60: 2, 120: 4}[h]
                        pred_t = float(residuals[h_idx])
                        pred_s = float(residuals[h_idx + 1])
                        diff_t = np.clip(pred_t - base["temperature"], -RESIDUAL_CLIPS["temperature"] * scale, RESIDUAL_CLIPS["temperature"] * scale)
                        diff_s = np.clip(pred_s - base["soil_moisture"], -RESIDUAL_CLIPS["soil_moisture"] * scale, RESIDUAL_CLIPS["soil_moisture"] * scale)
                        base["temperature"] += float(diff_t)
                        base["soil_moisture"] += float(diff_s)
                    elif len(residuals) >= 12:
                        # 12-target model: [temp, soil, hum, light] for each horizon
                        offset = {30: 0, 60: 4, 120: 8}[h]
                        keys = ("temperature", "soil_moisture", "humidity", "light")
                        for i, key in enumerate(keys):
                            clip = RESIDUAL_CLIPS[key] * scale
                            base[key] = base[key] + float(np.clip(residuals[offset + i], -clip, clip))
                except Exception as ex:
                    print(f"[Predictor] Residual correction skipped for h={h}: {ex}")
            base = self.physics.apply_phase_constraints(current, base, dt, h)
            horizons[h] = {
                "temperature": round(float(base["temperature"]), 1),
                "humidity": round(float(base["humidity"]), 1),
                "soil_moisture": round(float(base["soil_moisture"]), 1),
                "light": round(float(base["light"]), 1),
            }

        solar = self.physics.solar_features(dt, light)
        confidence = 0.82 if self.loader.get_model() is not None else 0.78
        if solar["is_day"] < 0.5:
            confidence += 0.04  # night physics is more certain than daytime weather

        return {
            "timestamp": dt.isoformat(),
            "model_version": self.loader.get_version(),
            "engine": "physics-hybrid",
            "horizon_30m": horizons[30],
            "horizon_60m": horizons[60],
            "horizon_120m": horizons[120],
            "confidence": round(min(confidence, 0.93), 2),
            "diagnostics": {
                "hour": round(solar["hour"], 2),
                "solar_elevation_deg": round(solar["solar_elevation"], 1),
                "clear_sky_light_pct": round(solar["clear_sky_light"], 1),
                "effective_light_pct": round(solar["effective_light"], 1),
                "used_residual_ml": self.loader.get_model() is not None,
            },
        }

    def _residual_correction(self, current: dict, timestamp_str: str):
        model = self.loader.get_model()
        if model is None:
            return None
        try:
            expected = self.loader.get_feature_names()
            features = FeatureEngineering.extract_features(
                current["temperature"],
                current["humidity"],
                current["soil_moisture"],
                current["light"],
                timestamp_str,
                feature_names=expected,
            )
            return model.predict(features)[0]
        except Exception as e:
            print(f"[Predictor] Residual ML skipped: {e}")
            return None
