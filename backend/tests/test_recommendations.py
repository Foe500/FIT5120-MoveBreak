from datetime import datetime
from zoneinfo import ZoneInfo

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base
from models import Place
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
    assert status["maximum_sensor_distance_m"] == 500.0
    assert isinstance(response["recommendations"][0]["footfall_available"], bool)
