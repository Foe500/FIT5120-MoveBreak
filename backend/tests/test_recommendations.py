from datetime import datetime
from zoneinfo import ZoneInfo

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base
from models import FootfallProfile, PedestrianSensor, Place
from recommendation_contract import RecommendationResponse
from recommendations import build_recommendation_response


@pytest.fixture
def db():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    session.add(
        Place(
            id="test-park",
            name="Test Park",
            latitude=-37.8150,
            longitude=144.9669,
            type="Outdoor Space",
            status="Open data",
            category="Outdoor Space",
            dataset_type="park",
            position=[-37.8150, 144.9669],
            source_dataset="test",
        )
    )
    session.commit()
    yield session
    session.close()
    engine.dispose()


def test_recommendations_keep_working_without_model_assets(db):
    request_time = datetime(2026, 10, 8, 12, tzinfo=ZoneInfo("Australia/Melbourne"))
    response = build_recommendation_response(
        -37.8150,
        144.9669,
        15,
        db=db,
        limit=5,
        need="green space",
        request_time=request_time,
    )

    assert response["request_time"] == request_time.isoformat()
    assert response["contract_version"] == 1
    assert response["ranking"]["weights"]["footfall_suitability"] == 0.40
    assert response["data_status"]["record_count"] == 1

    recommendation = response["recommendations"][0]
    assert recommendation["is_time_safe"] is True
    assert recommendation["weather_available"] is False
    assert recommendation["ranking_signals"]["weather_comfort_score"] == 0.5
    assert recommendation["need_adjustment"] > 0
    assert 0 <= recommendation["base_recommendation_score"] <= 1
    assert recommendation["recommendation_score"] == pytest.approx(
        recommendation["base_recommendation_score"] * 100
    )

    # These are the exact fields consumed by ExploreMap and its local
    # preference re-ranking. The response model also protects the OpenAPI
    # contract from accidental backend-only renames.
    frontend_fields = {
        "id",
        "name",
        "category",
        "dataset_type",
        "position",
        "markerTone",
        "distance_m",
        "walking_distance_m",
        "walking_time_one_way",
        "walking_time_one_way_label",
        "activity_time",
        "buffer_time",
        "estimated_total_time",
        "remaining_time",
        "base_recommendation_score",
        "ranking_signals",
        "footfall_available",
        "footfall_percentile",
    }
    assert frontend_fields <= recommendation.keys()
    assert RecommendationResponse.model_validate(response).contract_version == 1


def test_recommendation_response_reports_model_fallback_status(db):
    response = build_recommendation_response(
        -37.8150,
        144.9669,
        15,
        db=db,
        limit=5,
    )

    status = response["footfall_model"]
    assert status["supported_sensor_ids"] == [17, 19, 79]
    assert status["installed_sensor_ids"] == []
    assert status["sqlite_profile_available"] is False
    assert status["modelled_hourly_profile_available"] is False
    assert status["expected_profile_count"] == 504
    assert status["maximum_sensor_distance_m"] == 500.0
    assert isinstance(response["recommendations"][0]["footfall_available"], bool)


def test_recommendations_use_complete_sqlite_footfall_profile(db):
    sensor_locations = {
        17: (-37.813625, 144.973236),
        19: (-37.812372, 144.965507),
        79: (-37.817940, 144.966167),
    }
    db.add_all([
        PedestrianSensor(
            sensor_id=sensor_id,
            latitude=latitude,
            longitude=longitude,
            source_dataset="test-sensors",
        )
        for sensor_id, (latitude, longitude) in sensor_locations.items()
    ])
    db.flush()
    db.add_all([
        FootfallProfile(
            sensor_id=sensor_id,
            weekday=weekday,
            hour=hour,
            predicted_footfall=100 + hour + sensor_id,
            footfall_percentile=hour / 23,
            sample_count=4,
            model_name="test-model",
            source="test-profile",
        )
        for sensor_id in sensor_locations
        for weekday in range(7)
        for hour in range(24)
    ])
    db.commit()

    request_time = datetime(2026, 10, 8, 12, tzinfo=ZoneInfo("Australia/Melbourne"))
    response = build_recommendation_response(
        -37.8150,
        144.9669,
        15,
        db=db,
        limit=5,
        need="quiet space",
        request_time=request_time,
    )

    status = response["footfall_model"]
    assert status["sqlite_profile_available"] is True
    assert status["modelled_hourly_profile_available"] is True
    assert status["installed_sensor_ids"] == [17, 19, 79]
    assert status["sensor_count"] == 3
    assert status["profile_count"] == 504
    assert status["model_names"] == ["test-model"]

    recommendation = response["recommendations"][0]
    assert recommendation["footfall_available"] is True
    assert recommendation["footfall_source"] == "sqlite_modelled_weekday_hour_profile"
    assert recommendation["footfall_percentile"] == pytest.approx(12 / 23, abs=1e-4)
    assert RecommendationResponse.model_validate(response).contract_version == 1
