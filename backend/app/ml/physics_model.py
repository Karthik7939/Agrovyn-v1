"""Physics-based greenhouse microclimate model.

Live sensors are sparse and the synthetic CSV is not a real greenhouse log.
Forecasts therefore start from an energy-balance / ET model, then a residual
ML model (if present) may apply a small clipped correction.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Dict, Optional

import numpy as np

BANGALORE_LAT_DEG = 12.97
SUNRISE_HOUR = 6.1
SUNSET_HOUR = 18.2
SOLAR_NOON = 12.2
TEMP_PEAK_HOUR = 15.0
THERMAL_TAU_MIN = 70.0
STEP_MINUTES = 5.0


def parse_timestamp(timestamp_str: Optional[str] = None) -> datetime:
    if timestamp_str:
        try:
            return datetime.fromisoformat(timestamp_str.replace("Z", "+00:00")).replace(tzinfo=None)
        except Exception:
            pass
    return datetime.now()


def hour_fraction(dt: datetime) -> float:
    return dt.hour + dt.minute / 60.0 + dt.second / 3600.0


def cyclic_hour_features(hour: float) -> tuple[float, float]:
    angle = 2.0 * np.pi * (hour / 24.0)
    return float(np.sin(angle)), float(np.cos(angle))


def solar_elevation_deg(hour: float, day_of_year: int = 172) -> float:
    """Approximate solar elevation for Bangalore (degrees)."""
    decl = 23.45 * np.sin(2.0 * np.pi * (284 + day_of_year) / 365.0)
    lat = np.radians(BANGALORE_LAT_DEG)
    ha = np.radians((hour - SOLAR_NOON) * 15.0)
    elev = np.arcsin(
        np.sin(lat) * np.sin(np.radians(decl))
        + np.cos(lat) * np.cos(np.radians(decl)) * np.cos(ha)
    )
    return float(np.degrees(elev))


def clear_sky_light_pct(hour: float, day_of_year: int = 172) -> float:
    elev = solar_elevation_deg(hour, day_of_year)
    if elev <= 0:
        return 0.0
    # Air-mass damped envelope, 0-100%
    raw = np.sin(np.radians(elev)) ** 1.05
    return float(np.clip(100.0 * raw, 0.0, 100.0))


def outdoor_temperature(hour: float, weather_bias: float = 0.0) -> float:
    """Diurnal outdoor air: minimum near sunrise, maximum mid-afternoon."""
    t_mean = 24.5 + weather_bias
    t_amp = 6.8
    # Phase so peak is ~15:00 and trough ~03:00
    return t_mean + t_amp * np.cos(2.0 * np.pi * (hour - TEMP_PEAK_HOUR) / 24.0)


def effective_solar_light(hour: float, ldr_pct: float, day_of_year: int = 172) -> float:
    """Blend LDR with solar geometry so night sensor noise cannot look like sun."""
    sky = clear_sky_light_pct(hour, day_of_year)
    ldr = float(np.clip(ldr_pct, 0.0, 100.0))
    if sky < 4.0:
        # After sunset / before sunrise: LDR offset is not solar gain
        return min(ldr, sky + 1.5)
    cloud = float(np.clip(ldr / max(sky, 1.0), 0.18, 1.20))
    return float(np.clip(sky * cloud, 0.0, 100.0))


class GreenhousePhysics:
    def __init__(self, latitude: float = BANGALORE_LAT_DEG):
        self.latitude = latitude

    def solar_features(self, dt: datetime, ldr_pct: float) -> dict:
        hour = hour_fraction(dt)
        doy = int(dt.timetuple().tm_yday)
        sky = clear_sky_light_pct(hour, doy)
        elev = solar_elevation_deg(hour, doy)
        solar = effective_solar_light(hour, ldr_pct, doy)
        sin_h, cos_h = cyclic_hour_features(hour)
        return {
            "hour": hour,
            "day_of_year": doy,
            "sin_hour": sin_h,
            "cos_hour": cos_h,
            "solar_elevation": elev,
            "clear_sky_light": sky,
            "effective_light": solar,
            "is_day": 1.0 if elev > 0 else 0.0,
        }

    def step(
        self,
        temperature: float,
        humidity: float,
        soil: float,
        light_ldr: float,
        dt: datetime,
        minutes: float = STEP_MINUTES,
        pdlc_opacity: float = 0.0,
        irrigation_on: bool = False,
    ) -> dict:
        hour = hour_fraction(dt)
        doy = int(dt.timetuple().tm_yday)
        solar = effective_solar_light(hour, light_ldr, doy)
        t_out = outdoor_temperature(hour)
        shade = 1.0 - 0.55 * (float(np.clip(pdlc_opacity, 0, 100)) / 100.0)
        solar_gain = 0.14 * solar * shade  # extra °C above outdoor at equilibrium
        t_eq = t_out + solar_gain - 0.6 * max(humidity - 60.0, 0.0) / 40.0

        alpha = 1.0 - np.exp(-minutes / THERMAL_TAU_MIN)
        temperature = float(temperature + alpha * (t_eq - temperature))

        # Light follows the solar envelope, carrying current cloudiness forward
        sky_now = max(clear_sky_light_pct(hour, doy), 1e-3)
        next_dt = dt + timedelta(minutes=minutes)
        sky_next = clear_sky_light_pct(hour_fraction(next_dt), int(next_dt.timetuple().tm_yday))
        if sky_now < 4.0:
            light = max(0.0, float(solar) * np.exp(-minutes / 18.0))
        else:
            cloud = float(np.clip(solar / sky_now, 0.18, 1.20))
            light = float(np.clip(sky_next * cloud, 0.0, 100.0))

        hours = minutes / 60.0
        et = hours * (0.28 + 0.045 * max(temperature - 16.0, 0.0) + 0.022 * solar) * (
            1.20 - humidity / 250.0
        )
        if irrigation_on:
            soil = soil + 6.5 * hours * 12  # pump adds moisture quickly while on
        soil = float(np.clip(soil - et, 5.0, 95.0))

        rh_eq = float(np.clip(78.0 - 0.85 * (temperature - 18.0) + 0.12 * (soil - 45.0), 35.0, 95.0))
        humidity = float(np.clip(humidity + 0.28 * (rh_eq - humidity), 20.0, 95.0))

        return {
            "temperature": round(temperature, 3),
            "humidity": round(humidity, 3),
            "soil_moisture": round(soil, 3),
            "light": round(light, 3),
        }

    def rollout(
        self,
        temperature: float,
        humidity: float,
        soil: float,
        light_ldr: float,
        timestamp_str: Optional[str] = None,
        horizons_min=(30, 60, 120),
        pdlc_opacity: float = 0.0,
        irrigation_on: bool = False,
    ) -> Dict[int, dict]:
        dt = parse_timestamp(timestamp_str)
        state = {
            "temperature": float(temperature),
            "humidity": float(humidity),
            "soil_moisture": float(soil),
            "light": float(light_ldr),
        }
        forecasts: Dict[int, dict] = {}
        elapsed = 0.0
        max_h = max(horizons_min)
        while elapsed < max_h - 1e-6:
            state = self.step(
                state["temperature"],
                state["humidity"],
                state["soil_moisture"],
                state["light"],
                dt,
                STEP_MINUTES,
                pdlc_opacity,
                irrigation_on,
            )
            dt += timedelta(minutes=STEP_MINUTES)
            elapsed += STEP_MINUTES
            for h in horizons_min:
                if abs(elapsed - h) < 1e-6:
                    forecasts[h] = dict(state)
        return forecasts

    def apply_phase_constraints(
        self,
        current: dict,
        forecast: dict,
        dt: datetime,
        horizon_min: int,
    ) -> dict:
        """Hard guardrails so night forecasts cannot heat or brighten from solar."""
        hour = hour_fraction(dt)
        future_hour = (hour + horizon_min / 60.0) % 24.0
        doy = int(dt.timetuple().tm_yday)
        sky_now = clear_sky_light_pct(hour, doy)
        sky_future = clear_sky_light_pct(future_hour, doy)

        t0 = current["temperature"]
        t1 = forecast["temperature"]
        light1 = forecast["light"]
        soil1 = forecast["soil_moisture"]

        # After solar noon, temperature must not keep climbing once the sun is falling,
        # except a short thermal-lag window (peak ~15:00).
        if hour >= 16.5 and t1 > t0:
            # Allow tiny lag, then force cooling
            lag_cap = max(0.15, 0.45 - 0.15 * (hour - 16.5))
            t1 = t0 + min(t1 - t0, lag_cap)
        if sky_now < 4.0 and t1 > t0:
            t1 = t0 - max(0.2, 0.35 * (horizon_min / 30.0))
        if hour >= 18.0:
            cool = 0.55 * (horizon_min / 30.0) * max(0.4, (t0 - outdoor_temperature(hour)) / 8.0)
            t1 = min(t1, t0 - cool)

        if sky_future <= sky_now and light1 > current["light"] + 1.0:
            light1 = current["light"] * max(sky_future / max(sky_now, 1.0), 0.0)
        if sky_now < 4.0:
            light1 = min(light1, current["light"] * np.exp(-horizon_min / 25.0), 3.0)

        if soil1 > current["soil_moisture"] + 0.05:
            # No irrigation in the open-loop forecast
            soil1 = current["soil_moisture"] - 0.15 * (horizon_min / 30.0)

        # Humidity rises as the greenhouse cools at night
        h0 = current["humidity"]
        h1 = forecast["humidity"]
        if t1 < t0 and h1 < h0:
            h1 = h0 + 0.35 * (t0 - t1)

        return {
            "temperature": float(np.clip(t1, 8.0, 48.0)),
            "humidity": float(np.clip(h1, 20.0, 95.0)),
            "soil_moisture": float(np.clip(soil1, 5.0, 95.0)),
            "light": float(np.clip(light1, 0.0, 100.0)),
        }
