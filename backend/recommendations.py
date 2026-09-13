import csv
import math
from functools import lru_cache
from pathlib import Path


DATA_PATH = Path(__file__).parent / "data" / "recommendation_places.csv"
MELBOURNE_TOWN_HALL = (-37.8150, 144.9669)
STRAIGHT_LINE_DETOUR_FACTOR = 1.35
GRID_ROUTE_DETOUR_FACTOR = 1.15
WALKING_SPEED_METRES_PER_MINUTE = 70
EARTH_RADIUS_METRES = 6371000

BREAK_CONFIG = {
    5: {"activity_time": 1, "buffer_time": 1},
    15: {"activity_time": 4, "buffer_time": 1},
    30: {"activity_time": 8, "buffer_time": 2},
}

CATEGORY_WEIGHTS = {
    5: {
        "public_seat": 38,
        "drinking_fountain": 34,
        "cafe_restaurant": 16,
        "supermarket": 10,
        "park": 8,
    },
    15: {
        "park": 34,
        "public_seat": 26,
        "drinking_fountain": 22,
        "cafe_restaurant": 22,
        "supermarket": 12,
    },
    30: {
        "park": 42,
        "cafe_restaurant": 20,
        "public_seat": 18,
        "drinking_fountain": 16,
        "supermarket": 10,
    },
}

MARKER_TONES = {
    "park": "green",
    "public_seat": "blue",
    "drinking_fountain": "blue",
    "cafe_restaurant": "gold",
    "supermarket": "gold",
}


def _to_float(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


@lru_cache(maxsize=1)
def load_recommendation_places():
    places = []
    with DATA_PATH.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for index, row in enumerate(reader, start=1):
            latitude = _to_float(row.get("latitude"))
            longitude = _to_float(row.get("longitude"))
            if latitude is None or longitude is None:
                continue

            dataset_type = row.get("dataset_type", "").strip()
            places.append(
                {
                    "id": row.get("record_id", "").strip() or f"place-{index}",
                    "record_id": row.get("record_id", "").strip() or f"place-{index}",
                    "dataset_type": dataset_type,
                    "name": row.get("name", "").strip() or "Unnamed place",
                    "category": row.get("category", "").strip() or dataset_type,
                    "type": row.get("category", "").strip() or dataset_type,
                    "description": row.get("description", "").strip(),
                    "address": row.get("address", "").strip(),
                    "latitude": latitude,
                    "longitude": longitude,
                    "position": [latitude, longitude],
                    "source_dataset": row.get("source_dataset", "").strip(),
                    "marker": str(index),
                    "markerTone": MARKER_TONES.get(dataset_type, "blue"),
                    "status": "Open data",
                }
            )
    return places


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
    # Without a live routing API, combine straight-line and city-grid estimates
    # so recommendations stay conservative around roads, blocks and waterfronts.
    lat1, lon1 = origin
    lat2, lon2 = destination
    north_south_metres = haversine_distance_metres((lat1, lon1), (lat2, lon1))
    east_west_metres = haversine_distance_metres((lat2, lon1), (lat2, lon2))
    grid_distance_m = north_south_metres + east_west_metres
    straight_distance_m = haversine_distance_metres(origin, destination)

    return max(
        straight_distance_m * STRAIGHT_LINE_DETOUR_FACTOR,
        grid_distance_m * GRID_ROUTE_DETOUR_FACTOR,
    )


def _distance_score(distance_m):
    if distance_m <= 80:
        return 40
    if distance_m >= 1600:
        return 0
    return round(40 * (1 - ((distance_m - 80) / 1520)), 2)


def _duration_fit_score(remaining_time):
    if remaining_time < 0:
        return 0
    if remaining_time <= 2:
        return 10
    if remaining_time <= 8:
        return 18
    return 14


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


def _build_explanation(place, available_break_time, estimated_total_time, remaining_time):
    return (
        f"Fits within your {available_break_time}-minute break with "
        f"{remaining_time} minutes spare. Estimated total time is "
        f"{estimated_total_time} minutes including the round trip walk, rest time and buffer."
    )


def calculate_recommendations(
    latitude,
    longitude,
    break_time,
    limit=5,
    places=None,
):
    if break_time not in BREAK_CONFIG:
        raise ValueError("break_time must be one of 5, 15 or 30")

    origin = (latitude, longitude)
    config = BREAK_CONFIG[break_time]
    source_places = places if places is not None else load_recommendation_places()
    recommendations = []

    for place in source_places:
        destination = (place["latitude"], place["longitude"])
        straight_distance_m = haversine_distance_metres(origin, destination)
        walking_distance_m = estimate_walking_distance_metres(origin, destination)
        walking_time_one_way = walking_distance_m / WALKING_SPEED_METRES_PER_MINUTE
        estimated_total_time = (
            walking_time_one_way * 2
            + config["activity_time"]
            + config["buffer_time"]
        )
        remaining_time = break_time - estimated_total_time

        if remaining_time < 0:
            continue

        walking_time_display = _display_minutes(walking_time_one_way, minimum=1)
        walking_round_trip_display = walking_time_display * 2
        estimated_total_display = (
            walking_round_trip_display
            + config["activity_time"]
            + config["buffer_time"]
        )
        remaining_time_display = max(0, break_time - estimated_total_display)
        category_score = CATEGORY_WEIGHTS[break_time].get(place["dataset_type"], 6)
        recommendation_score = round(
            _distance_score(straight_distance_m)
            + category_score
            + _duration_fit_score(remaining_time),
            2,
        )

        recommendations.append(
            {
                **place,
                "distance_m": round(straight_distance_m),
                "walking_distance_m": round(walking_distance_m),
                "walking_time_one_way": walking_time_display,
                "walking_time_one_way_label": _display_minute_label(walking_time_one_way),
                "walking_time_round_trip": walking_round_trip_display,
                "activity_time": config["activity_time"],
                "buffer_time": config["buffer_time"],
                "estimated_total_time": estimated_total_display,
                "available_break_time": break_time,
                "remaining_time": remaining_time_display,
                "is_time_safe": True,
                "recommendation_score": recommendation_score,
                "distance": f"{_display_minute_label(walking_time_one_way)} each way",
                "explanation": _build_explanation(
                    place,
                    break_time,
                    estimated_total_display,
                    remaining_time_display,
                ),
            }
        )

    recommendations.sort(
        key=lambda item: (
            -item["recommendation_score"],
            item["estimated_total_time"],
            item["distance_m"],
            item["name"],
        )
    )
    return recommendations[:limit]


def build_recommendation_response(latitude, longitude, break_time, limit=5):
    recommendations = calculate_recommendations(latitude, longitude, break_time, limit)
    return {
        "origin": {"latitude": latitude, "longitude": longitude},
        "available_break_time": break_time,
        "recommendations": recommendations,
        "calculation": {
            "distance_method": "Haversine straight-line distance",
            "straight_line_detour_factor": STRAIGHT_LINE_DETOUR_FACTOR,
            "grid_route_detour_factor": GRID_ROUTE_DETOUR_FACTOR,
            "walking_speed_m_per_min": WALKING_SPEED_METRES_PER_MINUTE,
            "activity_time": BREAK_CONFIG[break_time]["activity_time"],
            "buffer_time": BREAK_CONFIG[break_time]["buffer_time"],
            "formula": "2 * walking_time_one_way + activity_time + buffer_time",
            "walking_distance_method": "max(straight-line detour, city-grid detour)",
        },
        "data_status": {
            "source": "City of Melbourne Open Data CSV",
            "record_count": len(load_recommendation_places()),
            "message": "Recommendations are calculated from the outdoor POI dataset.",
        },
    }
