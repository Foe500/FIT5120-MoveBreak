"""Model-informed pedestrian activity estimates for MoveBreak recommendations.

The tuned Random Forest is a rolling one-hour-ahead model. Exact inference is
only valid when a feature row exists for the requested sensor and hour because
the model requires lagged pedestrian counts. For normal website requests outside
that historical feature window, this service falls back to a weekday/hour
profile built from the tuned model's untouched final-test predictions.

Expected optional files under ``backend/model``:

* footfall_model_selected.joblib
* model_ready_data.csv
* final_test_predictions.csv

Missing model files never break the recommendation endpoint. The caller receives
an explicit unavailable result and can continue with distance and amenity scores.
"""

from __future__ import annotations

import math
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from threading import Lock
from typing import Optional
from zoneinfo import ZoneInfo

import joblib
import numpy as np
import pandas as pd


MELBOURNE_TIMEZONE = ZoneInfo("Australia/Melbourne")
MODEL_DIR = Path(__file__).resolve().parent / "model"
MODEL_PATH = MODEL_DIR / "footfall_model_selected.joblib"
MODEL_READY_PATH = MODEL_DIR / "model_ready_data.csv"
FINAL_TEST_PREDICTIONS_PATH = MODEL_DIR / "final_test_predictions.csv"

MAX_SENSOR_DISTANCE_METRES = 500.0
EARTH_RADIUS_METRES = 6_371_000

# Coordinates validated in the modelling notebook against the official City of
# Melbourne Pedestrian Counting System sensor-location dataset.
SENSOR_LOCATIONS = {
    17: (-37.813625, 144.973236),
    19: (-37.812372, 144.965507),
    79: (-37.817940, 144.966167),
}


@dataclass(frozen=True)
class FootfallEstimate:
    available: bool
    sensor_id: Optional[int] = None
    sensor_distance_m: Optional[float] = None
    predicted_footfall: Optional[float] = None
    footfall_percentile: Optional[float] = None
    source: str = "unavailable"
    reason: Optional[str] = None
    is_live_forecast: bool = False

    def to_dict(self) -> dict:
        return asdict(self)


def _haversine_distance_metres(origin, destination):
    lat1, lon1 = origin
    lat2, lon2 = destination
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    r_lat1 = math.radians(lat1)
    r_lat2 = math.radians(lat2)
    h = (
        math.sin(d_lat / 2) ** 2
        + math.cos(r_lat1) * math.cos(r_lat2) * math.sin(d_lon / 2) ** 2
    )
    return 2 * EARTH_RADIUS_METRES * math.asin(math.sqrt(h))


def _as_melbourne_hour(value: Optional[datetime]) -> datetime:
    timestamp = value or datetime.now(MELBOURNE_TIMEZONE)
    if timestamp.tzinfo is None:
        timestamp = timestamp.replace(tzinfo=MELBOURNE_TIMEZONE)
    else:
        timestamp = timestamp.astimezone(MELBOURNE_TIMEZONE)
    return timestamp.replace(minute=0, second=0, microsecond=0)


class FootfallService:
    """Load model assets once and provide safe model-informed estimates."""

    def __init__(self):
        self._lock = Lock()
        self._loaded = False
        self._artifact = None
        self._feature_rows = None
        self._profile = None
        self._sensor_prediction_distributions = {}
        self._load_messages = []

    def _load(self):
        if self._loaded:
            return

        with self._lock:
            if self._loaded:
                return

            if MODEL_PATH.exists() and MODEL_READY_PATH.exists():
                try:
                    artifact = joblib.load(MODEL_PATH)
                    required_keys = {"model", "feature_columns"}
                    if not required_keys <= set(artifact):
                        raise ValueError("Model artifact is missing its feature contract")

                    feature_rows = pd.read_csv(MODEL_READY_PATH, low_memory=False)
                    feature_rows["time_local"] = pd.to_datetime(
                        feature_rows["time_local"], utc=True, errors="coerce"
                    ).dt.tz_convert(MELBOURNE_TIMEZONE)
                    feature_rows["sensor_id"] = pd.to_numeric(
                        feature_rows["sensor_id"], errors="coerce"
                    ).astype("Int64")
                    feature_rows = feature_rows.dropna(subset=["time_local", "sensor_id"])
                    feature_rows["target_hour"] = feature_rows["time_local"].dt.floor("h")

                    missing = set(artifact["feature_columns"]) - set(feature_rows.columns)
                    if missing:
                        raise ValueError(f"Model-ready data is missing columns: {sorted(missing)}")

                    self._artifact = artifact
                    self._feature_rows = feature_rows
                except Exception as error:  # Endpoint must retain its non-ML fallback.
                    self._load_messages.append(f"Exact inference assets rejected: {error}")

            if FINAL_TEST_PREDICTIONS_PATH.exists():
                try:
                    predictions = pd.read_csv(FINAL_TEST_PREDICTIONS_PATH)
                    required = {"time_local", "sensor_id", "selected_prediction"}
                    missing = required - set(predictions.columns)
                    if missing:
                        raise ValueError(f"Final-test predictions missing: {sorted(missing)}")

                    predictions["time_local"] = pd.to_datetime(
                        predictions["time_local"], utc=True, errors="coerce"
                    ).dt.tz_convert(MELBOURNE_TIMEZONE)
                    predictions["sensor_id"] = pd.to_numeric(
                        predictions["sensor_id"], errors="coerce"
                    ).astype("Int64")
                    predictions["selected_prediction"] = pd.to_numeric(
                        predictions["selected_prediction"], errors="coerce"
                    )
                    predictions = predictions.dropna(
                        subset=["time_local", "sensor_id", "selected_prediction"]
                    )
                    predictions["weekday"] = predictions["time_local"].dt.weekday
                    predictions["hour"] = predictions["time_local"].dt.hour

                    self._profile = (
                        predictions.groupby(["sensor_id", "weekday", "hour"], as_index=False)
                        ["selected_prediction"]
                        .median()
                    )
                    self._sensor_prediction_distributions = {
                        int(sensor_id): group["selected_prediction"].to_numpy(dtype=float)
                        for sensor_id, group in predictions.groupby("sensor_id")
                    }
                except Exception as error:
                    self._load_messages.append(f"Profile predictions rejected: {error}")

            self._loaded = True

    def status(self) -> dict:
        self._load()
        return {
            "exact_model_inference_available": (
                self._artifact is not None and self._feature_rows is not None
            ),
            "modelled_hourly_profile_available": self._profile is not None,
            "supported_sensor_ids": sorted(SENSOR_LOCATIONS),
            "maximum_sensor_distance_m": MAX_SENSOR_DISTANCE_METRES,
            "messages": list(self._load_messages),
        }

    def _nearest_sensor(self, latitude: float, longitude: float):
        candidates = [
            (
                sensor_id,
                _haversine_distance_metres(
                    (latitude, longitude), sensor_coordinates
                ),
            )
            for sensor_id, sensor_coordinates in SENSOR_LOCATIONS.items()
        ]
        sensor_id, distance = min(candidates, key=lambda item: item[1])
        return sensor_id, distance

    def _percentile(self, sensor_id: int, prediction: float) -> Optional[float]:
        values = self._sensor_prediction_distributions.get(sensor_id)
        if values is None or not len(values):
            return None
        return float(np.mean(values <= prediction))

    def estimate(
        self,
        latitude: float,
        longitude: float,
        request_time: Optional[datetime] = None,
    ) -> FootfallEstimate:
        self._load()
        sensor_id, distance = self._nearest_sensor(latitude, longitude)

        if distance > MAX_SENSOR_DISTANCE_METRES:
            return FootfallEstimate(
                available=False,
                sensor_id=sensor_id,
                sensor_distance_m=round(distance, 1),
                reason="No supported pedestrian sensor is within 500 metres",
            )

        target_hour = _as_melbourne_hour(request_time)

        if self._artifact is not None and self._feature_rows is not None:
            exact = self._feature_rows[
                self._feature_rows["sensor_id"].eq(sensor_id)
                & self._feature_rows["target_hour"].eq(pd.Timestamp(target_hour))
            ]
            if len(exact) == 1:
                feature_columns = self._artifact["feature_columns"]
                prediction = float(
                    np.clip(
                        self._artifact["model"].predict(exact[feature_columns])[0],
                        0,
                        None,
                    )
                )
                return FootfallEstimate(
                    available=True,
                    sensor_id=sensor_id,
                    sensor_distance_m=round(distance, 1),
                    predicted_footfall=round(prediction, 1),
                    footfall_percentile=self._percentile(sensor_id, prediction),
                    source="exact_historical_model_inference",
                    reason=(
                        "Exact inference uses a historical feature row; it is not a live forecast"
                    ),
                )

        if self._profile is not None:
            match = self._profile[
                self._profile["sensor_id"].eq(sensor_id)
                & self._profile["weekday"].eq(target_hour.weekday())
                & self._profile["hour"].eq(target_hour.hour)
            ]
            if len(match) == 1:
                prediction = float(match.iloc[0]["selected_prediction"])
                percentile = self._percentile(sensor_id, prediction)
                return FootfallEstimate(
                    available=True,
                    sensor_id=sensor_id,
                    sensor_distance_m=round(distance, 1),
                    predicted_footfall=round(prediction, 1),
                    footfall_percentile=percentile,
                    source="modelled_weekday_hour_profile",
                    reason=(
                        "Typical modelled activity from held-out test predictions; "
                        "not a live crowd measurement"
                    ),
                )

        return FootfallEstimate(
            available=False,
            sensor_id=sensor_id,
            sensor_distance_m=round(distance, 1),
            reason="Footfall model assets are not installed",
        )


footfall_service = FootfallService()
