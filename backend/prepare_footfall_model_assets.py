"""Validate notebook outputs and install them for the MoveBreak API.

Run from the repository root after both modelling notebooks have completed:

    python backend/prepare_footfall_model_assets.py \
        --outputs-dir /path/to/movebreak_footfall_model_outputs

This command does not retrain the model. The prediction notebook owns official
data download, cleaning and feature engineering; the tuning notebook owns model
selection and final-test evaluation. This command checks their exported contract
before copying only the files needed by the API into ``backend/model``.
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
import pandas as pd


EXPECTED_SENSOR_IDS = {17, 19, 79}
REQUIRED_MODEL_KEYS = {"model", "feature_columns", "sensor_ids", "target"}
REQUIRED_READY_COLUMNS = {"time_local", "sensor_id", "count"}
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


def inspect_csv(path: Path, required_columns: set[str]) -> dict:
    frame = pd.read_csv(path, low_memory=False)
    missing = required_columns - set(frame.columns)
    if missing:
        raise ValueError(f"{path.name} is missing columns: {sorted(missing)}")
    if frame.empty:
        raise ValueError(f"{path.name} contains no rows")

    parsed_time = pd.to_datetime(frame["time_local"], utc=True, errors="coerce")
    if parsed_time.isna().any():
        raise ValueError(f"{path.name} contains invalid time_local values")

    sensor_ids = {
        int(sensor_id)
        for sensor_id in pd.to_numeric(
            frame["sensor_id"], errors="raise"
        ).astype(int).unique()
    }
    if sensor_ids != EXPECTED_SENSOR_IDS:
        raise ValueError(
            f"{path.name} sensor IDs are {sorted(sensor_ids)}; "
            f"expected {sorted(EXPECTED_SENSOR_IDS)}"
        )

    return {
        "rows": int(len(frame)),
        "sensor_ids": sorted(sensor_ids),
        "start_utc": parsed_time.min().isoformat(),
        "end_utc": parsed_time.max().isoformat(),
    }


def validate_sources(outputs_dir: Path) -> tuple[dict[str, Path], dict]:
    sources = {
        "footfall_model_selected.joblib": (
            outputs_dir / "tuning" / "footfall_model_selected.joblib"
        ),
        "final_test_predictions.csv": (
            outputs_dir / "tuning" / "final_test_predictions.csv"
        ),
        "model_ready_data.csv": outputs_dir / "model_ready_data.csv",
    }
    missing_files = [str(path) for path in sources.values() if not path.is_file()]
    if missing_files:
        raise FileNotFoundError(
            "Required notebook outputs were not found:\n- " + "\n- ".join(missing_files)
        )

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

    audit = {
        "model": {
            "model_name": artifact.get("model_name"),
            "target": artifact["target"],
            "sensor_ids": sorted(artifact_sensors),
            "feature_columns": list(artifact["feature_columns"]),
            "parameters": artifact.get("parameters"),
        },
        "model_ready_data": inspect_csv(
            sources["model_ready_data.csv"], REQUIRED_READY_COLUMNS
        ),
        "final_test_predictions": inspect_csv(
            sources["final_test_predictions.csv"], REQUIRED_PREDICTION_COLUMNS
        ),
    }
    return sources, audit


def install_assets(outputs_dir: Path, destination: Path) -> Path:
    outputs_dir = outputs_dir.expanduser().resolve()
    destination = destination.expanduser().resolve()
    sources, audit = validate_sources(outputs_dir)

    destination.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(
        prefix="movebreak-model-assets-", dir=destination.parent
    ) as temporary_directory:
        staging = Path(temporary_directory)
        installed_files = {}

        for filename, source in sources.items():
            staged_path = staging / filename
            shutil.copy2(source, staged_path)
            installed_files[filename] = {
                "bytes": staged_path.stat().st_size,
                "sha256": sha256_file(staged_path),
            }

        manifest = {
            "created_at_utc": datetime.now(timezone.utc).isoformat(),
            "source_outputs_directory": str(outputs_dir),
            "files": installed_files,
            "audit": audit,
        }
        manifest_path = staging / "asset_manifest.json"
        manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

        for staged_path in staging.iterdir():
            os.replace(staged_path, destination / staged_path.name)

    return destination / "asset_manifest.json"


def parse_args():
    parser = argparse.ArgumentParser(
        description="Validate and install MoveBreak footfall model assets."
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
        default=Path(__file__).resolve().parent / "model",
        help="Destination model directory (default: backend/model).",
    )
    return parser.parse_args()


def main():
    args = parse_args()
    manifest_path = install_assets(args.outputs_dir, args.destination)
    print(f"Validated and installed MoveBreak model assets: {manifest_path.parent}")
    print(f"Manifest: {manifest_path}")


if __name__ == "__main__":
    main()
