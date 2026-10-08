import math
from datetime import datetime

from sqlalchemy.orm import Session

from footfall_service import footfall_service
from models import Place


MELBOURNE_TOWN_HALL = (-37.8150, 144.9669)
STRAIGHT_LINE_DETOUR_FACTOR = 1.35
GRID_ROUTE_DETOUR_FACTOR = 1.15
WALKING_SPEED_METRES_PER_MINUTE = 70
EARTH_RADIUS_METRES = 6_371_000

BREAK_CONFIG = {
    5: {"activity_time": 1, "buffer_time": 1},
    15: {"activity_time": 4, "buffer_time": 1},
    30: {"activity_time": 8, "buffer_time": 2},
}

CATEGORY_WEIGHTS = {
    5: {
        "public_seat": 38, "drinking_fountain": 34,
        "cafe_restaurant": 16, "supermarket": 10, "park": 8,
    },
    15: {
        "park": 34, "public_seat": 26, "drinking_fountain": 22,
        "cafe_restaurant": 22, "supermarket": 12,
    },
    30: {
        "park": 42, "cafe_restaurant": 20, "public_seat": 18,
        "drinking_fountain": 16, "supermarket": 10,
    },
}

RANKING_WEIGHTS = {
    "footfall_suitability": 0.40,
    "distance_score": 0.30,
    "weather_comfort_score": 0.15,
    "amenity_score": 0.15,
}
MAX_NEED_ADJUSTMENT = 0.10

MARKER_TONES = {
    "park": "green",
    "public_seat": "blue",
    "drinking_fountain": "blue",
    "cafe_restaurant": "gold",
    "supermarket": "gold",
}

OUTDOOR_NEED_CATEGORY_WEIGHTS = {
    "fresh air": {"park": 16, "public_seat": 6},
    "green space": {"park": 22},
    "quiet space": {"park": 12, "public_seat": 10, "cafe_restaurant": -8, "supermarket": -8},
    "short walk": {"public_seat": 10, "drinking_fountain": 8, "park": 4},
    "low effort": {"public_seat": 16, "drinking_fountain": 8, "park": 5},
}


def place_to_recommendation_dict(place):
    return {
        "id": place.id,
        "record_id": place.id,
        "dataset_type": place.dataset_type,
        "name": place.name,
        "category": place.category,
        "type": place.type or place.category,
        "description": place.description or "",
        "address": place.address or "Address unavailable",
        "latitude": place.latitude,
        "longitude": place.longitude,
        "position": [place.latitude, place.longitude],
        "source_dataset": place.source_dataset,
        "marker": None,
        "markerTone": place.markerTone or MARKER_TONES.get(place.dataset_type, "blue"),
        "status": place.status or "Open data",
    }


def haversine_distance_metres(origin, destination):
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


def estimate_walking_distance_metres(origin, destination):
    lat1, lon1 = origin
    lat2, lon2 = destination
    north_south = haversine_distance_metres((lat1, lon1), (lat2, lon1))
    east_west = haversine_distance_metres((lat2, lon1), (lat2, lon2))
    straight = haversine_distance_metres(origin, destination)
    return max(
        straight * STRAIGHT_LINE_DETOUR_FACTOR,
        (north_south + east_west) * GRID_ROUTE_DETOUR_FACTOR,
    )


def _maximum_straight_distance(break_time):
    config = BREAK_CONFIG[break_time]
    one_way_minutes = (
        break_time - config["activity_time"] - config["buffer_time"]
    ) / 2
    maximum_walking_distance = one_way_minutes * WALKING_SPEED_METRES_PER_MINUTE
    return maximum_walking_distance / STRAIGHT_LINE_DETOUR_FACTOR


def _validate_finite_coordinate(value, name, minimum, maximum):
    if not math.isfinite(value) or value < minimum or value > maximum:
        raise ValueError(f"{name} must be a finite number between {minimum:g} and {maximum:g}")


def load_recommendation_places(db: Session, latitude=None, longitude=None,
                               break_time=None):
    """Read places from SQLite, optionally prefiltered by a SQL bounding box."""
    query = db.query(Place)
    if latitude is not None and longitude is not None and break_time in BREAK_CONFIG:
        radius = _maximum_straight_distance(break_time)
        latitude_delta = radius / 111_320
        longitude_scale = max(0.1, math.cos(math.radians(latitude)))
        longitude_delta = radius / (111_320 * longitude_scale)
        query = query.filter(
            Place.latitude.between(latitude - latitude_delta, latitude + latitude_delta),
            Place.longitude.between(longitude - longitude_delta, longitude + longitude_delta),
        )
    return [place_to_recommendation_dict(place) for place in query.all()]


def _distance_score(distance_m):
    if distance_m <= 80:
        return 1.0
    if distance_m >= 1600:
        return 0.0
    return round(1 - ((distance_m - 80) / 1520), 4)


def _amenity_score(dataset_type, break_time):
    weights = CATEGORY_WEIGHTS[break_time]
    highest_weight = max(weights.values())
    return round(weights.get(dataset_type, 6) / highest_weight, 4)


def _balanced_footfall_suitability(percentile):
    """Prefer moderate pedestrian activity until the browser applies a preference."""
    if percentile is None:
        return 0.5
    return round(max(0.0, 1 - abs(float(percentile) - 0.5) * 2), 4)


def _need_score(place, need, straight_distance):
    if not need:
        return 0

    normalized_need = need.lower()
    dataset_type = place["dataset_type"]
    score = OUTDOOR_NEED_CATEGORY_WEIGHTS.get(normalized_need, {}).get(dataset_type, 0)

    if normalized_need in {"short walk", "low effort"}:
        if straight_distance <= 180:
            score += 14
        elif straight_distance <= 350:
            score += 8
        elif straight_distance > 700:
            score -= 8

    if normalized_need == "quiet space":
        search_text = " ".join([
            place.get("name", ""),
            place.get("category", ""),
            place.get("type", ""),
            place.get("description", ""),
        ]).lower()
        if any(term in search_text for term in ["garden", "reserve", "library", "park"]):
            score += 6

    return score


def _display_minutes(value, minimum=0):
    display_value = round(value)
    if value > 0:
        display_value = max(1, display_value)
    return max(minimum, display_value)


def _display_minute_label(value):
    if value <= 0:
        return "0 min"
    if value < 1:
        return "<1 min"
    return f"{round(value)} min"


def calculate_recommendations(latitude, longitude, break_time, db, limit=5,
                              places=None, need=None,
                              request_time: datetime | None = None):
    if break_time not in BREAK_CONFIG:
        raise ValueError("break_time must be one of 5, 15 or 30")
    _validate_finite_coordinate(latitude, "latitude", -90, 90)
    _validate_finite_coordinate(longitude, "longitude", -180, 180)

    origin = (latitude, longitude)
    config = BREAK_CONFIG[break_time]
    source_places = places if places is not None else load_recommendation_places(
        db, latitude, longitude, break_time
    )
    recommendations = []

    for place in source_places:
        destination = (place["latitude"], place["longitude"])
        straight_distance = haversine_distance_metres(origin, destination)
        walking_distance = estimate_walking_distance_metres(origin, destination)
        one_way_exact = walking_distance / WALKING_SPEED_METRES_PER_MINUTE
        total_exact = (
            one_way_exact * 2 + config["activity_time"] + config["buffer_time"]
        )
        remaining_exact = break_time - total_exact
        if remaining_exact < 0:
            continue

        one_way_display = _display_minutes(one_way_exact, minimum=1)
        round_trip_display = one_way_display * 2
        total_display = (
            round_trip_display + config["activity_time"] + config["buffer_time"]
        )
        remaining_display = max(0, break_time - total_display)
        footfall = footfall_service.estimate(
            place["latitude"], place["longitude"], request_time=request_time
        )
        ranking_signals = {
            "footfall_suitability": _balanced_footfall_suitability(
                footfall.footfall_percentile
            ),
            "distance_score": _distance_score(walking_distance),
            # No request-time weather provider is installed yet. A neutral
            # value is explicit and avoids presenting historical weather as live.
            "weather_comfort_score": 0.5,
            "amenity_score": _amenity_score(place["dataset_type"], break_time),
        }
        objective_score = sum(
            RANKING_WEIGHTS[signal] * value
            for signal, value in ranking_signals.items()
        )
        need_adjustment = max(
            -MAX_NEED_ADJUSTMENT,
            min(
                MAX_NEED_ADJUSTMENT,
                _need_score(place, need, straight_distance) / 100,
            ),
        )
        base_score = round(
            min(1.0, max(0.0, objective_score + need_adjustment)),
            4,
        )

        recommendations.append({
            **place,
            "distance_m": round(straight_distance),
            "walking_distance_m": round(walking_distance),
            "walking_time_one_way": one_way_display,
            "walking_time_one_way_label": _display_minute_label(one_way_exact),
            "walking_time_round_trip": round_trip_display,
            "activity_time": config["activity_time"],
            "buffer_time": config["buffer_time"],
            "estimated_total_time": total_display,
            "available_break_time": break_time,
            "remaining_time": remaining_display,
            "is_time_safe": True,
            # Keep the legacy 0-100 field while exposing the new 0-1 contract.
            "recommendation_score": round(base_score * 100, 2),
            "base_recommendation_score": base_score,
            "ranking_signals": ranking_signals,
            "need_adjustment": round(need_adjustment, 4),
            "predicted_footfall": footfall.predicted_footfall,
            "footfall_percentile": footfall.footfall_percentile,
            "footfall_available": footfall.available,
            "footfall_sensor_id": footfall.sensor_id,
            "footfall_sensor_distance_m": footfall.sensor_distance_m,
            "footfall_source": footfall.source,
            "footfall_note": footfall.reason,
            "weather_available": False,
            "distance": f"{_display_minute_label(one_way_exact)} each way",
            "explanation": (
                f"Fits within your {break_time}-minute break with "
                f"{remaining_display} minutes spare. Estimated total time is "
                f"{total_display} minutes including return walking, rest and buffer."
            ),
        })

    recommendations.sort(key=lambda item: (
        -item["recommendation_score"], item["estimated_total_time"],
        item["distance_m"], item["name"],
    ))
    return recommendations[:limit]


def build_recommendation_response(latitude, longitude, break_time, db, limit=5,
                                  need=None,
                                  request_time: datetime | None = None):
    recommendations = calculate_recommendations(
        latitude,
        longitude,
        break_time,
        db=db,
        limit=limit,
        need=need,
        request_time=request_time,
    )
    return {
        "contract_version": 1,
        "origin": {"latitude": latitude, "longitude": longitude},
        "available_break_time": break_time,
        "request_time": request_time.isoformat() if request_time else None,
        "recommendations": recommendations,
        "ranking": {
            "weights": RANKING_WEIGHTS,
            "maximum_need_adjustment": MAX_NEED_ADJUSTMENT,
            "personalisation": (
                "The API produces the time-safe base ranking; browser "
                "localStorage may apply a limited preference re-ranking."
            ),
        },
        "footfall_model": footfall_service.status(),
        "calculation": {
            "distance_method": (
                "Approximate walking distance using Haversine and city-grid detours"
            ),
            "straight_line_detour_factor": STRAIGHT_LINE_DETOUR_FACTOR,
            "grid_route_detour_factor": GRID_ROUTE_DETOUR_FACTOR,
            "walking_speed_m_per_min": WALKING_SPEED_METRES_PER_MINUTE,
            "activity_time": BREAK_CONFIG[break_time]["activity_time"],
            "buffer_time": BREAK_CONFIG[break_time]["buffer_time"],
            "formula": "2 * walking_time_one_way + activity_time + buffer_time",
        },
        "data_status": {
            "source": "City of Melbourne Open Data stored in SQLite",
            "record_count": db.query(Place).count(),
            "message": "Recommendations are queried from the places table, not CSV.",
        },
    }
