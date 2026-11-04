import numpy as np
from datetime import datetime
from .physics_model import GreenhousePhysics, parse_timestamp


# Full 10-feature set (for future models trained with solar geometry)
FEATURE_NAMES_FULL = [
    "temperature",
    "humidity",
    "soil_moisture",
    "light",
    "sin_hour",
    "cos_hour",
    "solar_elevation",
    "clear_sky_light",
    "effective_light",
    "is_day",
]

# Legacy 6-feature set (matches the currently trained greenhouse_model.pkl)
FEATURE_NAMES_V1 = [
    "temperature",
    "humidity",
    "soil_moisture_percent",
    "light",
    "sin_hour",
    "cos_hour",
]

# Default used by the predictor for feature-name comparison
FEATURE_NAMES = FEATURE_NAMES_FULL


class FeatureEngineering:
    physics = GreenhousePhysics()

    @staticmethod
    def extract_features(
        temperature: float,
        humidity: float,
        soil_moisture: float,
        light: float,
        timestamp_str: str = None,
        feature_names: list = None,
    ) -> np.ndarray:
        """Extract features matching the given feature_names list.

        If feature_names matches the legacy 6-feature model, only those 6 are returned.
        Otherwise the full 10-feature solar-augmented vector is returned.
        """
        dt = parse_timestamp(timestamp_str)
        solar = FeatureEngineering.physics.solar_features(dt, light)

        # If the model expects the legacy 6-feature schema, return exactly that
        if feature_names is not None and set(feature_names) == set(FEATURE_NAMES_V1):
            features = np.array([
                float(temperature),
                float(humidity),
                float(soil_moisture),
                float(light),
                solar["sin_hour"],
                solar["cos_hour"],
            ]).reshape(1, -1)
            return features

        # Full 10-feature vector (solar-augmented)
        features = np.array([
            float(temperature),
            float(humidity),
            float(soil_moisture),
            float(light),
            solar["sin_hour"],
            solar["cos_hour"],
            solar["solar_elevation"],
            solar["clear_sky_light"],
            solar["effective_light"],
            solar["is_day"],
        ]).reshape(1, -1)
        return features

    @staticmethod
    def extract_from_row(temperature, humidity, soil, light, dt: datetime) -> np.ndarray:
        return FeatureEngineering.extract_features(
            temperature, humidity, soil, light, dt.isoformat()
        )
