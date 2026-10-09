"""SQLite-backed model-informed pedestrian activity estimates.

The modelling pipeline aggregates its untouched final-test predictions into a
compact weekday/hour profile during installation. Runtime requests query those
profiles from the existing MoveBreak SQLite database and never load modelling
CSV files into the API process.

The result is historical model-informed context, not a live crowd measurement.
"""

from __future__ import annotations

import math
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from typing import Optional
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from models import FootfallProfile, PedestrianSensor


MELBOURNE_TIMEZONE = ZoneInfo("Australia/Melbourne")
MODEL_PATH = Path(__file__).resolve().parent / "model" / "footfall_model_selected.joblib"
MAX_SENSOR_DISTANCE_METRES = 500.0
EARTH_RADIUS_METRES = 6_371_000
EXPECTED_SENSOR_IDS = {17, 19, 79}
EXPECTED_PROFILE_COUNT = len(EXPECTED_SENSOR_IDS) * 7 * 24


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


@dataclass(frozen=True)
class FootfallRequestContext:
    """Profiles loaded once for every place evaluated in one API request."""

    target_hour: datetime
    sensors: tuple[PedestrianSensor, ...]
    profiles_by_sensor: dict[int, FootfallProfile]


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
    """Read installed SQLite profiles and provide safe footfall estimates."""

    def prepare_context(
        self,
        db: Session,
        request_time: Optional[datetime] = None,
    ) -> FootfallRequestContext:
        target_hour = _as_melbourne_hour(request_time)
        sensors = tuple(
            db.query(PedestrianSensor)
            .order_by(PedestrianSensor.sensor_id)
            .all()
        )
        profiles = (
            db.query(FootfallProfile)
            .filter(
                FootfallProfile.weekday == target_hour.weekday(),
                FootfallProfile.hour == target_hour.hour,
            )
            .all()
        )
        return FootfallRequestContext(
            target_hour=target_hour,
            sensors=sensors,
            profiles_by_sensor={profile.sensor_id: profile for profile in profiles},
        )

    def status(self, db: Session) -> dict:
        sensor_count = db.query(PedestrianSensor).count()
        profile_count = db.query(FootfallProfile).count()
        installed_sensor_ids = [
            sensor_id
            for (sensor_id,) in db.query(PedestrianSensor.sensor_id)
            .order_by(PedestrianSensor.sensor_id)
            .all()
        ]
        model_names = sorted({
            name
            for (name,) in db.query(FootfallProfile.model_name).distinct().all()
            if name
        })
        sqlite_profile_available = (
            set(installed_sensor_ids) == EXPECTED_SENSOR_IDS
            and profile_count == EXPECTED_PROFILE_COUNT
        )
        messages = []
        if not sqlite_profile_available:
            messages.append(
                "SQLite footfall profiles are not installed or are incomplete; "
                "recommendations use neutral footfall suitability."
            )

        return {
            # Compatibility fields retained for the current React/API contract.
            "exact_model_inference_available": False,
            "modelled_hourly_profile_available": sqlite_profile_available,
            "sqlite_profile_available": sqlite_profile_available,
            "model_artifact_installed": MODEL_PATH.is_file(),
            "supported_sensor_ids": sorted(EXPECTED_SENSOR_IDS),
            "installed_sensor_ids": installed_sensor_ids,
            "sensor_count": sensor_count,
            "profile_count": profile_count,
            "expected_profile_count": EXPECTED_PROFILE_COUNT,
            "model_names": model_names,
            "maximum_sensor_distance_m": MAX_SENSOR_DISTANCE_METRES,
            "is_live_forecast": False,
            "messages": messages,
        }

    def estimate(
        self,
        db: Session,
        latitude: float,
        longitude: float,
        request_time: Optional[datetime] = None,
        context: Optional[FootfallRequestContext] = None,
    ) -> FootfallEstimate:
        request_context = context or self.prepare_context(db, request_time)
        if not request_context.sensors:
            return FootfallEstimate(
                available=False,
                reason=(
                    "Footfall profiles are not installed in SQLite; run "
                    "prepare_footfall_model_assets.py"
                ),
            )

        sensor, distance = min(
            (
                (
                    sensor,
                    _haversine_distance_metres(
                        (latitude, longitude),
                        (sensor.latitude, sensor.longitude),
                    ),
                )
                for sensor in request_context.sensors
            ),
            key=lambda item: item[1],
        )

        if distance > MAX_SENSOR_DISTANCE_METRES:
            return FootfallEstimate(
                available=False,
                sensor_id=sensor.sensor_id,
                sensor_distance_m=round(distance, 1),
                reason="No supported pedestrian sensor is within 500 metres",
            )

        profile = request_context.profiles_by_sensor.get(sensor.sensor_id)
        if profile is None:
            return FootfallEstimate(
                available=False,
                sensor_id=sensor.sensor_id,
                sensor_distance_m=round(distance, 1),
                reason="No SQLite footfall profile exists for the requested weekday and hour",
            )

        return FootfallEstimate(
            available=True,
            sensor_id=sensor.sensor_id,
            sensor_distance_m=round(distance, 1),
            predicted_footfall=round(profile.predicted_footfall, 1),
            footfall_percentile=round(profile.footfall_percentile, 4),
            source="sqlite_modelled_weekday_hour_profile",
            reason=(
                "Typical activity derived from held-out model predictions; "
                "not a live crowd measurement"
            ),
        )


footfall_service = FootfallService()
