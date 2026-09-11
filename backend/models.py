"""
SQLAlchemy models for MoveBreak Melbourne.
One table per data type: Activity and Place.
Field names match the existing activities.json / places.json schemas exactly,
so the frontend and Mission API don't need any changes.
"""

from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, String, Integer, Float, JSON
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
    steps = Column(JSON, nullable=True)                   # [{text, seconds}, ...]
    safetyNotes = Column(JSON, nullable=True)              # [string, ...]
    demoInstruction = Column(String, nullable=True)


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


class Team(Base):
    """A team is fully anonymous: just a chosen name and a join code.
    No personal data is collected to create or join one."""
    __tablename__ = "teams"

    id = Column(String, primary_key=True, index=True)       # uuid4 hex
    name = Column(String, nullable=False)
    join_code = Column(String, unique=True, nullable=False, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class TeamMember(Base):
    """A member is identified only by a self-chosen nickname plus an
    anonymous device id the frontend generates and stores in
    localStorage — nothing that identifies a real person."""
    __tablename__ = "team_members"

    id = Column(String, primary_key=True, index=True)       # uuid4 hex, == the device id
    team_id = Column(String, ForeignKey("teams.id"), nullable=False, index=True)
    nickname = Column(String, nullable=False)
    joined_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class SessionLog(Base):
    """One row per completed guided break/session, used to build the
    team leaderboard. Carries no personal data — just what was done,
    for how long, and which anonymous member did it."""
    __tablename__ = "session_logs"

    id = Column(String, primary_key=True, index=True)       # uuid4 hex
    team_id = Column(String, ForeignKey("teams.id"), nullable=False, index=True)
    member_id = Column(String, ForeignKey("team_members.id"), nullable=False, index=True)
    setting = Column(String, nullable=False)                 # Indoor / Outdoor
    label = Column(String, nullable=True)                     # activity/session title, for display only
    seconds = Column(Integer, nullable=False)
    completed_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class Season(Base):
    """A one-week competition window for a team. The leaderboard only
    counts SessionLog rows that fall inside [start_at, end_at). When a
    week ends, its winner is computed once and frozen onto this row —
    starting a new week (renew) never deletes old session data, it
    just opens a new window going forward."""
    __tablename__ = "seasons"

    id = Column(String, primary_key=True, index=True)       # uuid4 hex
    team_id = Column(String, ForeignKey("teams.id"), nullable=False, index=True)
    week_number = Column(Integer, nullable=False)
    start_at = Column(DateTime, nullable=False)
    end_at = Column(DateTime, nullable=False)
    winner_member_id = Column(String, nullable=True)
    winner_nickname = Column(String, nullable=True)          # denormalized so history reads without a join
    winner_points = Column(Integer, nullable=True)
    finalized_at = Column(DateTime, nullable=True)
