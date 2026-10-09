"""Typed HTTP contract for MoveBreak place recommendations.

Keeping this separate from the ranking implementation lets FastAPI validate
the payload that the React client consumes without coupling the UI to the
SQLAlchemy models.
"""

from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class RecommendationOrigin(BaseModel):
    latitude: float
    longitude: float


class RankingSignals(BaseModel):
    footfall_suitability: float = Field(ge=0, le=1)
    distance_score: float = Field(ge=0, le=1)
    weather_comfort_score: float = Field(ge=0, le=1)
    amenity_score: float = Field(ge=0, le=1)


class RecommendationItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    record_id: str
    dataset_type: str
    name: str
    category: str
    type: str
    description: str
    address: str
    latitude: float
    longitude: float
    position: tuple[float, float]
    source_dataset: str
    marker: Optional[str] = None
    markerTone: str
    status: str
    distance_m: int = Field(ge=0)
    walking_distance_m: int = Field(ge=0)
    walking_time_one_way: int = Field(ge=0)
    walking_time_one_way_label: str
    walking_time_round_trip: int = Field(ge=0)
    activity_time: int = Field(ge=0)
    buffer_time: int = Field(ge=0)
    estimated_total_time: int = Field(ge=0)
    available_break_time: int
    remaining_time: int = Field(ge=0)
    is_time_safe: bool
    recommendation_score: float = Field(ge=0, le=100)
    base_recommendation_score: float = Field(ge=0, le=1)
    ranking_signals: RankingSignals
    need_adjustment: float
    predicted_footfall: Optional[float] = Field(default=None, ge=0)
    footfall_percentile: Optional[float] = Field(default=None, ge=0, le=1)
    footfall_available: bool
    footfall_sensor_id: Optional[int] = None
    footfall_sensor_distance_m: Optional[float] = Field(default=None, ge=0)
    footfall_source: str
    footfall_note: Optional[str] = None
    weather_available: bool
    distance: str
    explanation: str


class RankingMetadata(BaseModel):
    weights: RankingSignals
    maximum_need_adjustment: float = Field(ge=0, le=1)
    personalisation: str


class FootfallModelStatus(BaseModel):
    exact_model_inference_available: bool
    modelled_hourly_profile_available: bool
    sqlite_profile_available: bool
    model_artifact_installed: bool
    supported_sensor_ids: list[int]
    installed_sensor_ids: list[int]
    sensor_count: int = Field(ge=0)
    profile_count: int = Field(ge=0)
    expected_profile_count: int = Field(ge=0)
    model_names: list[str]
    maximum_sensor_distance_m: float = Field(gt=0)
    is_live_forecast: bool
    messages: list[str]


class RecommendationCalculation(BaseModel):
    distance_method: str
    straight_line_detour_factor: float = Field(gt=0)
    grid_route_detour_factor: float = Field(gt=0)
    walking_speed_m_per_min: float = Field(gt=0)
    activity_time: int = Field(ge=0)
    buffer_time: int = Field(ge=0)
    formula: str


class RecommendationDataStatus(BaseModel):
    source: str
    record_count: int = Field(ge=0)
    place_record_count: int = Field(ge=0)
    pedestrian_sensor_count: int = Field(ge=0)
    footfall_profile_count: int = Field(ge=0)
    message: str


class RecommendationResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    contract_version: int = Field(ge=1)
    origin: RecommendationOrigin
    available_break_time: int
    request_time: Optional[str] = None
    recommendations: list[RecommendationItem]
    ranking: RankingMetadata
    footfall_model: FootfallModelStatus
    calculation: RecommendationCalculation
    data_status: RecommendationDataStatus
