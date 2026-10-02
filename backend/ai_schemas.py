"""Strict public contract for the assistant. Durations are always minutes."""
from datetime import datetime
from typing import Literal, Optional
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Turn(StrictModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=3000)


class Origin(StrictModel):
    latitude: float = Field(ge=-90, le=90, allow_inf_nan=False)
    longitude: float = Field(ge=-180, le=180, allow_inf_nan=False)


class ExistingItem(StrictModel):
    id: str = Field(min_length=1, max_length=200)
    startAt: datetime
    endAt: datetime

    @model_validator(mode="after")
    def valid_interval(self):
        if not self.startAt.tzinfo or not self.endAt.tzinfo or self.endAt <= self.startAt:
            raise ValueError("Existing plan times must have offsets and a positive duration")
        return self


class ChatRequest(StrictModel):
    message: str = Field(min_length=1, max_length=2000)
    timezone: str = "Australia/Melbourne"
    history: list[Turn] = Field(default_factory=list, max_length=12)
    existingPlan: list[ExistingItem] = Field(default_factory=list, max_length=100)
    origin: Optional[Origin] = None

    @field_validator("message")
    @classmethod
    def nonblank(cls, value):
        if not value.strip():
            raise ValueError("Message cannot be blank")
        return value.strip()

    @field_validator("timezone")
    @classmethod
    def valid_timezone(cls, value):
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError):
            raise ValueError("Use an IANA time zone such as Australia/Melbourne")
        return value


class Window(StrictModel):
    start: str = Field(max_length=40)
    end: str = Field(max_length=40)


class Intent(StrictModel):
    intent: Literal["recommend", "plan", "clarify", "unsupported"] = "recommend"
    language: str = Field(default="en", max_length=30, pattern=r"^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$")
    availableMinutes: Optional[int] = Field(default=None, ge=1, le=120)
    energy: Literal["low", "any"] = "any"
    setting: Literal["Indoor", "Outdoor", "Any"] = "Any"
    area: Optional[Literal["Eyes", "Neck", "Shoulders", "Back", "Wrists", "Legs", "Full Body"]] = None
    posture: Optional[Literal["Seated", "Standing"]] = None
    windows: list[Window] = Field(default_factory=list, max_length=6)
    clarification: str = Field(default="", max_length=500)


class ConfirmItem(StrictModel):
    token: str = Field(min_length=1, max_length=12000)
    startAt: datetime

    @field_validator("startAt")
    @classmethod
    def aware(cls, value):
        if not value.tzinfo:
            raise ValueError("startAt must include a time zone offset")
        return value


class ConfirmRequest(StrictModel):
    items: list[ConfirmItem] = Field(min_length=1, max_length=6)
    existingPlan: list[ExistingItem] = Field(default_factory=list, max_length=100)
