"""Validate notebook outputs and install SQLite-backed footfall assets.

Run this command after both modelling notebooks have completed:

    python backend/prepare_footfall_model_assets.py \
        --outputs-dir /path/to/movebreak_footfall_model_outputs

The fitted Joblib artifact remains a versioned model file. Final-test model
predictions are aggregated into a compact Melbourne weekday/hour profile and
stored in the existing SQLite database. Full CSV outputs remain offline
modelling evidence and are not loaded by the API at runtime.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import tempfile
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from models import Base, FootfallProfile, PedestrianSensor


EXPECTED_SENSOR_IDS = {17, 19, 79}
SENSOR_LOCATIONS = {
    17: (-37.813625, 144.973236),
    19: (-37.812372, 144.965507),
    79: (-37.817940, 144.966167),
}
SENSOR_SOURCE_DATASET = "pedestrian-counting-system-sensor-locations"
PROFILE_SOURCE = "median_of_untouched_final_test_model_predictions"
REQUIRED_MODEL_KEYS = {"model", "feature_columns", "sensor_ids", "target"}
REQUIRED_PREDICTION_COLUMNS = {
    "time_local",
    "sensor_id",
    "count",
    "selected_prediction",
    "seasonal_prediction",
}


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        while chunk := source.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def json_default(value):
    """Convert NumPy scalar metadata to JSON-safe Python values."""
    if isinstance(value, np.generic):
        return value.item()
    raise TypeError(f"Object of type {type(value).__name__} is not JSON serializable")


def inspect_predictions(path: Path) -> tuple[pd.DataFrame, dict]:
    frame = pd.read_csv(path, low_memory=False)
    missing = REQUIRED_PREDICTION_COLUMNS - set(frame.columns)
    if missing:
        raise ValueError(f"{path.name} is missing columns: {sorted(missing)}")
    if frame.empty:
        raise ValueError(f"{path.name} contains no rows")

    frame["time_local"] = pd.to_datetime(
        frame["time_local"], utc=True, errors="coerce"
    ).dt.tz_convert("Australia/Melbourne")
    frame["sensor_id"] = pd.to_numeric(
        frame["sensor_id"], errors="coerce"
    ).astype("Int64")
    frame["selected_prediction"] = pd.to_numeric(
        frame["selected_prediction"], errors="coerce"
    )
    frame["count"] = pd.to_numeric(frame["count"], errors="coerce")
    frame["seasonal_prediction"] = pd.to_numeric(
        frame["seasonal_prediction"], errors="coerce"
    )

    checked_columns = [
        "time_local",
        "sensor_id",
        "count",
        "selected_prediction",
        "seasonal_prediction",
    ]
    invalid = frame[checked_columns].isna().any(axis=1)
    if invalid.any():
        raise ValueError(f"{path.name} contains {int(invalid.sum())} invalid rows")
    if (frame[["count", "selected_prediction", "seasonal_prediction"]] < 0).any().any():
        raise ValueError(f"{path.name} contains negative count or prediction values")

    frame["sensor_id"] = frame["sensor_id"].astype(int)
    sensor_ids = {int(sensor_id) for sensor_id in frame["sensor_id"].unique()}
    if sensor_ids != EXPECTED_SENSOR_IDS:
        raise ValueError(
            f"{path.name} sensor IDs are {sorted(sensor_ids)}; "
            f"expected {sorted(EXPECTED_SENSOR_IDS)}"
        )

    frame["weekday"] = frame["time_local"].dt.weekday
    frame["hour"] = frame["time_local"].dt.hour
    expected_slots = {(weekday, hour) for weekday in range(7) for hour in range(24)}
    for sensor_id, group in frame.groupby("sensor_id"):
        actual_slots = set(zip(group["weekday"], group["hour"]))
        missing_slots = expected_slots - actual_slots
        if missing_slots:
            preview = sorted(missing_slots)[:5]
            raise ValueError(
                f"Sensor {sensor_id} has no final-test prediction for "
                f"{len(missing_slots)} weekday/hour slots; examples: {preview}"
            )

    audit = {
        "rows": int(len(frame)),
        "sensor_ids": sorted(sensor_ids),
        "start_utc": frame["time_local"].min().tz_convert("UTC").isoformat(),
        "end_utc": frame["time_local"].max().tz_convert("UTC").isoformat(),
    }
    return frame, audit


def build_profiles(predictions: pd.DataFrame, model_name: str | None) -> list[dict]:
    grouped = (
        predictions.groupby(["sensor_id", "weekday", "hour"], as_index=False)
        .agg(
            predicted_footfall=("selected_prediction", "median"),
            sample_count=("selected_prediction", "size"),
        )
        .sort_values(["sensor_id", "weekday", "hour"])
    )

    profiles = []
    for sensor_id, sensor_profiles in grouped.groupby("sensor_id", sort=True):
        distribution = predictions.loc[
            predictions["sensor_id"].eq(sensor_id), "selected_prediction"
        ].to_numpy(dtype=float)
        for row in sensor_profiles.itertuples(index=False):
            prediction = float(row.predicted_footfall)
            profiles.append({
                "sensor_id": int(sensor_id),
                "weekday": int(row.weekday),
                "hour": int(row.hour),
                "predicted_footfall": prediction,
                "footfall_percentile": float(np.mean(distribution <= prediction)),
                "sample_count": int(row.sample_count),
                "model_name": model_name,
                "source": PROFILE_SOURCE,
            })

    expected_rows = len(EXPECTED_SENSOR_IDS) * 7 * 24
    if len(profiles) != expected_rows:
        raise ValueError(
            f"Generated {len(profiles)} profile rows; expected {expected_rows}"
        )
    return profiles


def validate_sources(outputs_dir: Path) -> tuple[dict[str, Path], dict, list[dict]]:
    sources = {
        "footfall_model_selected.joblib": (
            outputs_dir / "tuning" / "footfall_model_selected.joblib"
        ),
        "final_test_predictions.csv": (
            outputs_dir / "tuning" / "final_test_predictions.csv"
        ),
    }
    missing_files = [str(path) for path in sources.values() if not path.is_file()]
    if missing_files:
        raise FileNotFoundError(
            "Required notebook outputs were not found:\n- " + "\n- ".join(missing_files)
        )

    # Joblib uses pickle internally. Only load artifacts produced by the trusted
    # MoveBreak modelling notebooks; never accept an arbitrary uploaded file.
    artifact = joblib.load(sources["footfall_model_selected.joblib"])
    if not isinstance(artifact, dict):
        raise ValueError("The saved model artifact must be a dictionary")
    missing_keys = REQUIRED_MODEL_KEYS - set(artifact)
    if missing_keys:
        raise ValueError(f"Model artifact is missing keys: {sorted(missing_keys)}")

    artifact_sensors = {int(sensor_id) for sensor_id in artifact["sensor_ids"]}
    if artifact_sensors != EXPECTED_SENSOR_IDS:
        raise ValueError(
            f"Model sensor IDs are {sorted(artifact_sensors)}; "
            f"expected {sorted(EXPECTED_SENSOR_IDS)}"
        )
    if not artifact["feature_columns"]:
        raise ValueError("Model artifact feature_columns is empty")
    if not hasattr(artifact["model"], "predict"):
        raise ValueError("Model artifact does not expose a predict method")

    predictions, prediction_audit = inspect_predictions(
        sources["final_test_predictions.csv"]
    )
    model_name = artifact.get("model_name")
    profiles = build_profiles(predictions, model_name)
    audit = {
        "model": {
            "model_name": model_name,
            "target": artifact["target"],
            "sensor_ids": sorted(artifact_sensors),
            "feature_columns": list(artifact["feature_columns"]),
            "parameters": artifact.get("parameters"),
        },
        "final_test_predictions": prediction_audit,
        "sqlite_profile": {
            "rows": len(profiles),
            "source": PROFILE_SOURCE,
        },
    }
    return sources, audit, profiles


def replace_sqlite_profiles(database_path: Path, profiles: list[dict]) -> dict:
    database_path.parent.mkdir(parents=True, exist_ok=True)
    engine = create_engine(
        f"sqlite:///{database_path.as_posix()}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(bind=engine)
    session_factory = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = session_factory()
    try:
        db.query(FootfallProfile).delete(synchronize_session=False)
        db.query(PedestrianSensor).delete(synchronize_session=False)
        db.add_all([
            PedestrianSensor(
                sensor_id=sensor_id,
                latitude=coordinates[0],
                longitude=coordinates[1],
                source_dataset=SENSOR_SOURCE_DATASET,
            )
            for sensor_id, coordinates in sorted(SENSOR_LOCATIONS.items())
        ])
        db.flush()
        db.add_all([FootfallProfile(**profile) for profile in profiles])
        db.commit()
        return {
            "database_path": str(database_path),
            "sensor_rows": db.query(PedestrianSensor).count(),
            "profile_rows": db.query(FootfallProfile).count(),
        }
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
        engine.dispose()


def install_assets(
    outputs_dir: Path,
    destination: Path,
    database_path: Path,
) -> Path:
    outputs_dir = outputs_dir.expanduser().resolve()
    destination = destination.expanduser().resolve()
    database_path = database_path.expanduser().resolve()
    sources, audit, profiles = validate_sources(outputs_dir)

    destination.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(
        prefix="movebreak-model-assets-", dir=destination.parent
    ) as temporary_directory:
        staging = Path(temporary_directory)
        model_source = sources["footfall_model_selected.joblib"]
        staged_model = staging / "footfall_model_selected.joblib"
        shutil.copy2(model_source, staged_model)

        sqlite_audit = replace_sqlite_profiles(database_path, profiles)
        manifest = {
            "created_at_utc": datetime.now(timezone.utc).isoformat(),
            "source_outputs_directory": str(outputs_dir),
            "files": {
                staged_model.name: {
                    "bytes": staged_model.stat().st_size,
                    "sha256": sha256_file(staged_model),
                }
            },
            "sqlite": sqlite_audit,
            "audit": audit,
        }
        manifest_path = staging / "asset_manifest.json"
        manifest_path.write_text(
            json.dumps(manifest, indent=2, default=json_default),
            encoding="utf-8",
        )

        for staged_path in staging.iterdir():
            os.replace(staged_path, destination / staged_path.name)

    return destination / "asset_manifest.json"


def parse_args():
    backend_dir = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser(
        description="Validate and install SQLite-backed MoveBreak footfall assets."
    )
    parser.add_argument(
        "--outputs-dir",
        required=True,
        type=Path,
        help="Path to movebreak_footfall_model_outputs.",
    )
    parser.add_argument(
        "--destination",
        type=Path,
        default=backend_dir / "model",
        help="Model-artifact directory (default: backend/model).",
    )
    parser.add_argument(
        "--database-path",
        type=Path,
        default=backend_dir / "movebreak.db",
        help="SQLite database path (default: backend/movebreak.db).",
    )
    return parser.parse_args()


def main():
    args = parse_args()
    manifest_path = install_assets(
        args.outputs_dir,
        args.destination,
        args.database_path,
    )
    print(f"Installed model artifact: {manifest_path.parent}")
    print(f"Updated SQLite database: {args.database_path.expanduser().resolve()}")
    print(f"Manifest: {manifest_path}")


if __name__ == "__main__":
    main()
