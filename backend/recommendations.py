"""Ranks nearby open-data places that fit a requested outdoor break time budget."""

import math

from sqlalchemy.orm import Session

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

MARKER_TONES = {
    "park": "green",
    "public_seat": "blue",
    "drinking_fountain": "blue",
    "cafe_restaurant": "gold",
    "supermarket": "gold",
}


def place_to_recommendation_dict(place):
    """Map a database place row to the stable frontend recommendation shape."""
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
    """Calculate straight-line distance between two latitude/longitude pairs in metres."""
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
    """Estimate a conservative CBD walking distance from direct and grid-style detours."""
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
    """Return the furthest direct distance that can still fit the full return-break budget."""
    config = BREAK_CONFIG[break_time]
    one_way_minutes = (
        break_time - config["activity_time"] - config["buffer_time"]
    ) / 2
    maximum_walking_distance = one_way_minutes * WALKING_SPEED_METRES_PER_MINUTE
    return maximum_walking_distance / STRAIGHT_LINE_DETOUR_FACTOR


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
    """Convert shorter walking distance into a bounded ranking contribution."""
    if distance_m <= 80:
        return 40
    if distance_m >= 1600:
        return 0
    return round(40 * (1 - ((distance_m - 80) / 1520)), 2)


def _duration_fit_score(remaining_time):
    """Reward plans that leave useful spare time without exceeding the time budget."""
    if remaining_time < 0:
        return 0
    if remaining_time <= 2:
        return 10
    if remaining_time <= 8:
        return 18
    return 14


def _display_minutes(value, minimum=0):
    """Round calculated minutes for UI display while honouring a required lower bound."""
    display_value = round(value)
    if value > 0:
        display_value = max(1, display_value)
    return max(minimum, display_value)


def _display_minute_label(value):
    """Format a numeric duration as a compact human-readable minute label."""
    if value <= 0:
        return "0 min"
    if value < 1:
        return "<1 min"
    return f"{round(value)} min"


def calculate_recommendations(latitude, longitude, break_time, db, limit=5,
                              places=None):
    """Rank time-safe places by distance, category suitability and spare break time."""
    if break_time not in BREAK_CONFIG:
        raise ValueError("break_time must be one of 5, 15 or 30")

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
        score = round(
            _distance_score(straight_distance)
            + CATEGORY_WEIGHTS[break_time].get(place["dataset_type"], 6)
            + _duration_fit_score(remaining_exact),
            2,
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
            "recommendation_score": score,
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


def build_recommendation_response(latitude, longitude, break_time, db, limit=5):
    """Package ranked places with the origin and calculation assumptions used by the frontend."""
    recommendations = calculate_recommendations(
        latitude, longitude, break_time, db=db, limit=limit
    )
    return {
        "origin": {"latitude": latitude, "longitude": longitude},
        "available_break_time": break_time,
        "recommendations": recommendations,
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
