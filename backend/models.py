"""
SQLAlchemy models for MoveBreak Melbourne.
One table per data type: Activity and Place.
Field names match the existing activities.json / places.json schemas exactly,
so the frontend and Mission API don't need any changes.
"""

from sqlalchemy import Column, String, Integer, Float, JSON
from database import Base


class Activity(Base):
    __tablename__ = "activities"

    id = Column(String, primary_key=True, index=True)
    area = Column(String, nullable=False)
    title = Column(String, nullable=False)
    description = Column(String, nullable=False)
    duration = Column(Integer, nullable=False)      # minutes: 5, 10, 15
    posture = Column(String, nullable=False)          # Seated / Standing
    setting = Column(String, nullable=False)           # Indoor / Outdoor
    category = Column(String, nullable=False)          # Stretch, Mobility, etc.
    intensity = Column(String, nullable=False)          # Low / Moderate / High
    imageUrl = Column(String, nullable=True)             # optional, may not exist yet


class Place(Base):
    __tablename__ = "places"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)
    distance = Column(String, nullable=True)           # e.g. "4 min walk"
    status = Column(String, nullable=True)               # e.g. "Best match"
    marker = Column(String, nullable=True)
    markerTone = Column(String, nullable=True)
    position = Column(JSON, nullable=False)              # [lat, lng] stored as JSON array
    address = Column(String, nullable=True)
