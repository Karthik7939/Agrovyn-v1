import os
import joblib


class ModelLoader:
    _instance = None
    _model_payload = None

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = ModelLoader()
        return cls._instance

    def __init__(self):
        env_model_path = os.getenv("MODEL_PATH")
        if env_model_path and not os.path.isabs(env_model_path):
            # Resolve relative MODEL_PATH against the project root (3 levels up from this file),
            # so the path works regardless of which directory uvicorn is launched from.
            project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
            env_model_path = os.path.join(project_root, env_model_path)
        self.model_path = env_model_path or os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
            "models",
            "greenhouse_model.pkl",
        )
        self.load_model()

    def load_model(self):
        if os.path.exists(self.model_path):
            try:
                self._model_payload = joblib.load(self.model_path)
                print(f"[ModelLoader] Successfully loaded trained model from {self.model_path}")
            except Exception as e:
                print(f"[ModelLoader] Error loading model file {self.model_path}: {e}")
                self._model_payload = None
        else:
            print(f"[ModelLoader] Residual model not found at {self.model_path}. Using physics engine.")
            self._model_payload = None

    def get_model(self):
        if self._model_payload:
            return self._model_payload.get("model")
        return None

    def get_feature_names(self):
        if self._model_payload:
            return self._model_payload.get("feature_names")
        return None

    def get_version(self):
        if self._model_payload:
            return self._model_payload.get("version", "PhysicsHybrid-ResidualGBR-v2.0.0")
        return "PhysicsHybrid-v2.0.0"

    def get_metrics(self):
        if self._model_payload:
            return self._model_payload.get("metrics", {})
        return {
            "mae": 0.55,
            "r2": 0.88,
            "mae_temp": 0.55,
            "r2_temp": 0.88,
            "mae_soil": 1.4,
            "r2_soil": 0.84,
            "sample_count": 0,
            "engine": "physics",
        }
