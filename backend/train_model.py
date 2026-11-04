"""Train a residual ML model on top of the greenhouse physics engine.

Targets are (observed_future - physics_forecast), not absolute sensor values.
That stops the model from learning inverted diurnal artifacts or from
predicting evening warming just because light is non-zero.
"""

import os
import argparse
import numpy as np
import pandas as pd
import joblib
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.multioutput import MultiOutputRegressor
from sklearn.metrics import mean_absolute_error, r2_score

from app.ml.physics_model import GreenhousePhysics
from app.ml.feature_engineering import FeatureEngineering, FEATURE_NAMES


SOIL_DRY_ADC = 439.0
SOIL_ADC_SCALE = 12.5
LIGHT_LUX_FULL_SCALE = 95000.0

RESIDUAL_TARGETS = [
    "d_temp_30", "d_soil_30", "d_hum_30", "d_light_30",
    "d_temp_60", "d_soil_60", "d_hum_60", "d_light_60",
    "d_temp_120", "d_soil_120", "d_hum_120", "d_light_120",
]


def parse_args():
    parser = argparse.ArgumentParser(description="AGROVYN physics-hybrid residual trainer")
    parser.add_argument("--data", type=str, default=None)
    parser.add_argument("--output", type=str, default=None)
    return parser.parse_args()


def _first_col(df, names):
    return next((c for c in names if c in df.columns), None)


def soil_to_percent(series: pd.Series) -> pd.Series:
    if series.min() > 100:
        # Synthetic ADC: higher = wetter (dataset_metadata.json)
        pct = (series - SOIL_DRY_ADC) / SOIL_ADC_SCALE
        return pct.clip(5, 95)
    return series.clip(0, 100)


def light_to_percent(series: pd.Series) -> pd.Series:
    if series.max() > 100:
        return (series / LIGHT_LUX_FULL_SCALE * 100.0).clip(0, 100)
    return series.clip(0, 100)


def prepare_residual_dataset(df: pd.DataFrame):
    col_map = {col: col.strip().lower() for col in df.columns}
    df = df.rename(columns=col_map)

    temp_col = _first_col(df, ["temperature", "temp"])
    hum_col = _first_col(df, ["humidity", "hum"])
    soil_col = _first_col(df, ["soil_moisture_percent", "soil_moisture", "soil"])
    light_col = _first_col(df, ["greenhouse_light", "ldr_percent", "light", "external_light"])

    if not all([temp_col, hum_col, soil_col, light_col]):
        raise ValueError(f"Missing required columns in CSV! Found: {list(df.columns)}")

    df = df.copy()
    df["temperature"] = df[temp_col].astype(float)
    df["humidity"] = df[hum_col].astype(float)
    df["soil_moisture"] = soil_to_percent(df[soil_col].astype(float))
    df["light"] = light_to_percent(df[light_col].astype(float))

    if "timestamp" in df.columns:
        df["timestamp"] = pd.to_datetime(df["timestamp"])
    else:
        raise ValueError("Dataset must include a timestamp column for physics-aligned training.")

    df = df.sort_values("timestamp").reset_index(drop=True)

    # Observed future values at +6 / +12 / +24 steps (5-minute sampling)
    df["obs_temp_30"] = df["temperature"].shift(-6)
    df["obs_soil_30"] = df["soil_moisture"].shift(-6)
    df["obs_hum_30"] = df["humidity"].shift(-6)
    df["obs_light_30"] = df["light"].shift(-6)
    df["obs_temp_60"] = df["temperature"].shift(-12)
    df["obs_soil_60"] = df["soil_moisture"].shift(-12)
    df["obs_hum_60"] = df["humidity"].shift(-12)
    df["obs_light_60"] = df["light"].shift(-12)
    df["obs_temp_120"] = df["temperature"].shift(-24)
    df["obs_soil_120"] = df["soil_moisture"].shift(-24)
    df["obs_hum_120"] = df["humidity"].shift(-24)
    df["obs_light_120"] = df["light"].shift(-24)
    df = df.dropna(subset=["obs_temp_120"]).reset_index(drop=True)

    physics = GreenhousePhysics()
    X_rows = []
    Y_rows = []

    print(f"[DatasetPrep] Computing physics residuals for {len(df)} rows...")
    for i, row in df.iterrows():
        ts = row["timestamp"].to_pydatetime()
        feats = FeatureEngineering.extract_features(
            row["temperature"], row["humidity"], row["soil_moisture"], row["light"], ts.isoformat()
        )[0]
        fc = physics.rollout(
            row["temperature"],
            row["humidity"],
            row["soil_moisture"],
            row["light"],
            timestamp_str=ts.isoformat(),
        )
        residual = [
            row["obs_temp_30"] - fc[30]["temperature"],
            row["obs_soil_30"] - fc[30]["soil_moisture"],
            row["obs_hum_30"] - fc[30]["humidity"],
            row["obs_light_30"] - fc[30]["light"],
            row["obs_temp_60"] - fc[60]["temperature"],
            row["obs_soil_60"] - fc[60]["soil_moisture"],
            row["obs_hum_60"] - fc[60]["humidity"],
            row["obs_light_60"] - fc[60]["light"],
            row["obs_temp_120"] - fc[120]["temperature"],
            row["obs_soil_120"] - fc[120]["soil_moisture"],
            row["obs_hum_120"] - fc[120]["humidity"],
            row["obs_light_120"] - fc[120]["light"],
        ]
        X_rows.append(feats)
        Y_rows.append(residual)
        if i > 0 and i % 1500 == 0:
            print(f"  ... {i}/{len(df)}")

    X = np.asarray(X_rows, dtype=float)
    Y = np.asarray(Y_rows, dtype=float)
    return df, X, Y


def train_and_export():
    args = parse_args()
    script_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(script_dir, "data")
    primary_csv = os.path.join(data_dir, "greenhouse_dataset.csv")
    fallback_csv = os.path.join(data_dir, "dataset.csv")

    csv_path = args.data
    if not csv_path or not os.path.exists(csv_path):
        if os.path.exists(primary_csv):
            csv_path = primary_csv
        elif os.path.exists(fallback_csv):
            csv_path = fallback_csv
        else:
            raise FileNotFoundError("No dataset CSV found! Please specify --data path/to/dataset.csv")

    print(f"Loading dataset from: {csv_path}")
    raw_df = pd.read_csv(csv_path)
    df, X, Y = prepare_residual_dataset(raw_df)
    print(f"Residual training set: X={X.shape}, Y={Y.shape}")
    print(f"Features: {FEATURE_NAMES}")

    n_total = len(X)
    n_train = int(n_total * 0.7)
    n_val = int(n_total * 0.15)
    X_train, Y_train = X[:n_train], Y[:n_train]
    X_val, Y_val = X[n_train : n_train + n_val], Y[n_train : n_train + n_val]
    X_test, Y_test = X[n_train + n_val :], Y[n_train + n_val :]

    print("\n[Training] Fitting residual MultiOutput GradientBoostingRegressor...")
    base = GradientBoostingRegressor(
        n_estimators=80,
        max_depth=3,
        learning_rate=0.08,
        random_state=42,
    )
    model = MultiOutputRegressor(base)
    model.fit(X_train, Y_train)

    val_preds = model.predict(X_val)
    test_preds = model.predict(X_test)
    val_mae = mean_absolute_error(Y_val, val_preds)
    test_mae = mean_absolute_error(Y_test, test_preds)
    val_r2 = r2_score(Y_val, val_preds)
    test_r2 = r2_score(Y_test, test_preds)

    print("\n==========================================")
    print("RESIDUAL MODEL EVALUATION (physics already subtracted):")
    print(f"Validation MAE: {val_mae:.4f} | R2: {val_r2:.4f}")
    print(f"Test MAE:       {test_mae:.4f} | R2: {test_r2:.4f}")
    print("==========================================")
    for idx, target in enumerate(RESIDUAL_TARGETS):
        mae_t = mean_absolute_error(Y_test[:, idx], test_preds[:, idx])
        r2_t = r2_score(Y_test[:, idx], test_preds[:, idx])
        print(f"  {target:<12} MAE: {mae_t:.3f}  R2: {r2_t:.3f}")

    models_dir = os.path.join(script_dir, "models")
    os.makedirs(models_dir, exist_ok=True)
    output_path = args.output or os.path.join(models_dir, "greenhouse_model.pkl")
    payload = {
        "model": model,
        "feature_names": FEATURE_NAMES,
        "target_names": RESIDUAL_TARGETS,
        "version": "PhysicsHybrid-ResidualGBR-v2.0.0",
        "metrics": {
            "mae": float(test_mae),
            "r2": float(test_r2),
            "mae_temp": float(mean_absolute_error(Y_test[:, 0], test_preds[:, 0])),
            "r2_temp": float(r2_score(Y_test[:, 0], test_preds[:, 0])),
            "mae_soil": float(mean_absolute_error(Y_test[:, 1], test_preds[:, 1])),
            "r2_soil": float(r2_score(Y_test[:, 1], test_preds[:, 1])),
            "sample_count": int(len(X_test)),
            "engine": "physics+residual",
        },
    }
    joblib.dump(payload, output_path)
    print(f"\n[Success] Exported residual model to: {output_path}")

    # Direction sanity check: evening must cool
    physics = GreenhousePhysics()
    evening_ts = "2026-10-13T18:30:00"
    fc = physics.rollout(28.5, 72.0, 45.0, 35.0, timestamp_str=evening_ts)
    print("\n[Sanity] Evening 18:30 starting T=28.5°C, LDR=35%:")
    for h in (30, 60, 120):
        dT = fc[h]["temperature"] - 28.5
        print(f"  +{h}m physics T={fc[h]['temperature']:.1f} (dT={dT:+.1f})  light={fc[h]['light']:.1f}")
        if dT > 0:
            raise SystemExit("Sanity failed: evening physics predicted warming.")
    print("[Sanity] Evening cooling OK.")


if __name__ == "__main__":
    # Allow `python backend/train_model.py` from repo root or backend/
    import sys

    backend_dir = os.path.dirname(os.path.abspath(__file__))
    root_dir = os.path.dirname(backend_dir)
    for path in (root_dir, backend_dir):
        if path not in sys.path:
            sys.path.insert(0, path)
    train_and_export()
