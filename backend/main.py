import os
import random
import secrets
import string
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import engine, get_db, Base
from models import Activity, Place, Team, TeamMember, SessionLog, Season
from recommendations import (
    MELBOURNE_TOWN_HALL,
    build_recommendation_response,
    calculate_recommendations,
    load_recommendation_places,
)

# Creates any tables that don't exist yet (e.g. the team/leaderboard
# tables added after activities/places already existed) without
# touching tables that are already there.
Base.metadata.create_all(bind=engine)

app = FastAPI(title="MoveBreak API")
DEFAULT_ALLOWED_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173"

JOIN_CODE_ALPHABET = "".join(sorted(set(string.ascii_uppercase + string.digits) - set("0O1I")))

# Leaderboard scoring: a flat bonus for completing a break, plus a small
# amount per second actually moved, so showing up often matters more
# than just racking up minutes in one long session.
POINTS_PER_SESSION = 10
POINTS_SECONDS_DIVISOR = 10

SEASON_LENGTH = timedelta(days=7)


def generate_join_code(length: int = 6) -> str:
    return "".join(secrets.choice(JOIN_CODE_ALPHABET) for _ in range(length))


def compute_points(sessions_completed: int, total_seconds: int) -> int:
    return sessions_completed * POINTS_PER_SESSION + total_seconds // POINTS_SECONDS_DIVISOR


def as_utc(dt: datetime) -> datetime:
    """SQLite drops tzinfo on round-trip, so datetimes read back from the
    DB come back naive even though we always write them as UTC-aware."""
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def start_new_season(team: Team, week_number: int, db: Session) -> Season:
    now = datetime.now(timezone.utc)
    season = Season(
        id=uuid.uuid4().hex,
        team_id=team.id,
        week_number=week_number,
        start_at=now,
        end_at=now + SEASON_LENGTH,
    )
    db.add(season)
    db.commit()
    db.refresh(season)
    return season


def get_current_season(team: Team, db: Session) -> Season:
    season = (
        db.query(Season)
        .filter(Season.team_id == team.id)
        .order_by(Season.week_number.desc())
        .first()
    )
    # Defensive fallback for a team that predates the season feature.
    return season or start_new_season(team, 1, db)


def finalize_season_if_ended(season: Season, db: Session) -> Season:
    now = datetime.now(timezone.utc)
    if now < as_utc(season.end_at) or season.finalized_at is not None:
        return season

    totals = dict(
        db.query(SessionLog.member_id, func.sum(SessionLog.seconds))
        .filter(
            SessionLog.team_id == season.team_id,
            SessionLog.completed_at >= season.start_at,
            SessionLog.completed_at < season.end_at,
        )
        .group_by(SessionLog.member_id)
        .all()
    )
    counts = dict(
        db.query(SessionLog.member_id, func.count(SessionLog.id))
        .filter(
            SessionLog.team_id == season.team_id,
            SessionLog.completed_at >= season.start_at,
            SessionLog.completed_at < season.end_at,
        )
        .group_by(SessionLog.member_id)
        .all()
    )

    # Only members still on the team are eligible — someone who left
    # mid-week shouldn't be crowned winner of a team they're no longer on.
    current_members = {
        m.id: m.nickname
        for m in db.query(TeamMember).filter(TeamMember.team_id == season.team_id).all()
    }

    best_member_id, best_points = None, -1
    for member_id, seconds in totals.items():
        if member_id not in current_members:
            continue
        points = compute_points(counts.get(member_id, 0), seconds)
        if points > best_points:
            best_member_id, best_points = member_id, points

    if best_member_id:
        season.winner_member_id = best_member_id
        season.winner_nickname = current_members[best_member_id]
        season.winner_points = best_points

    season.finalized_at = now
    db.commit()
    db.refresh(season)
    return season


def season_to_dict(season: Season) -> dict:
    now = datetime.now(timezone.utc)

    return {
        "weekNumber": season.week_number,
        "startAt": as_utc(season.start_at).isoformat(),
        "endAt": as_utc(season.end_at).isoformat(),
        "isActive": now < as_utc(season.end_at),
        "winner": (
            {"nickname": season.winner_nickname, "points": season.winner_points}
            if season.finalized_at and season.winner_member_id
            else None
        ),
    }


class MissionRequest(BaseModel):
    duration: int = 15
    setting: str = "Indoor"
    need: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class CreateTeamRequest(BaseModel):
    teamName: str


class JoinTeamRequest(BaseModel):
    nickname: str


class LeaveTeamRequest(BaseModel):
    memberId: str


class LogSessionRequest(BaseModel):
    memberId: str
    setting: str
    label: Optional[str] = None
    seconds: int


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in os.getenv("ALLOWED_ORIGINS", DEFAULT_ALLOWED_ORIGINS).split(",")
        if origin.strip()
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def activity_to_dict(a: Activity) -> dict:
    return {
        "id": a.id,
        "area": a.area,
        "title": a.title,
        "description": a.description,
        "duration": a.duration,
        "posture": a.posture,
        "setting": a.setting,
        "category": a.category,
        "intensity": a.intensity,
        "imageUrl": a.imageUrl,
        "steps": a.steps,
        "safetyNotes": a.safetyNotes,
        "demoInstruction": a.demoInstruction,
    }


def place_to_dict(p: Place) -> dict:
    return {
        "id": p.id,
        "name": p.name,
        "type": p.type,
        "distance": p.distance,
        "status": p.status,
        "marker": p.marker,
        "markerTone": p.markerTone,
        "position": p.position,
        "address": p.address,
    }


def matches_need(activity_dict: dict, need: Optional[str]) -> bool:
    if not need:
        return True
    search_text = " ".join(
        [
            activity_dict["area"],
            activity_dict["title"],
            activity_dict["description"],
            activity_dict["category"],
        ]
    ).lower()
    return need.lower() in search_text


@app.get("/")
def read_root():
    return {"name": "MoveBreak API", "status": "running"}


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/activities")
def get_activities(db: Session = Depends(get_db)):
    activities = db.query(Activity).all()
    return [activity_to_dict(a) for a in activities]


@app.get("/activities/{activity_id}")
def get_activity(activity_id: str, db: Session = Depends(get_db)):
    activity = db.query(Activity).filter(Activity.id == activity_id).first()

    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")

    return activity_to_dict(activity)


@app.get("/places")
def get_places(db: Session = Depends(get_db)):
    csv_places = load_recommendation_places()
    if csv_places:
        return csv_places

    places = db.query(Place).all()
    return [place_to_dict(p) for p in places]


@app.get("/recommendations")
def get_recommendations(
    lat: float = Query(MELBOURNE_TOWN_HALL[0]),
    lng: float = Query(MELBOURNE_TOWN_HALL[1]),
    break_time: int = Query(15),
    limit: int = Query(5, ge=1, le=10),
):
    try:
        return build_recommendation_response(lat, lng, break_time, limit)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@app.post("/missions/recommend")
def recommend_mission(request: MissionRequest, db: Session = Depends(get_db)):
    activities = [activity_to_dict(a) for a in db.query(Activity).all()]

    setting = request.setting.lower()

    if setting == "outdoor":
        origin = (
            request.latitude if request.latitude is not None else MELBOURNE_TOWN_HALL[0],
            request.longitude if request.longitude is not None else MELBOURNE_TOWN_HALL[1],
        )

        try:
            recommendations = calculate_recommendations(
                origin[0],
                origin[1],
                request.duration,
                limit=1,
            )
        except ValueError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error

        place = recommendations[0] if recommendations else None

        return {
            "id": f"{place['id']}-fresh-air-reset" if place else "fresh-air-reset",
            "title": f"{place['name']} Fresh-Air Reset" if place else "Fresh-Air Reset",
            "description": place["explanation"] if place else "No time-safe outdoor option was found for this break.",
            "duration": place["estimated_total_time"] if place else request.duration,
            "setting": "Outdoor",
            "place": place,
            "steps": [
                {"label": "Walk there", "duration": place["walking_time_one_way"] if place else 0},
                {"label": "Rest", "duration": place["activity_time"] if place else 0},
                {"label": "Walk back", "duration": place["walking_time_one_way"] if place else 0},
                {"label": "Buffer", "duration": place["buffer_time"] if place else 0},
            ],
            "recommendation": place,
        }

    matching_activities = [
        activity
        for activity in activities
        if activity["duration"] <= request.duration
        and activity["setting"].lower() == "indoor"
        and matches_need(activity, request.need)
    ]
    if not matching_activities:
        matching_activities = [
            activity
            for activity in activities
            if activity["duration"] <= request.duration
            and activity["setting"].lower() == "indoor"
        ]

    # Pick from the matching activities instead of always returning the first result.
    activity = random.choice(matching_activities)

    return {
        "id": f"{activity['id']}-mission",
        "title": activity["title"],
        "description": activity["description"],
        "duration": activity["duration"],
        "setting": activity["setting"],
        "activity": activity,
        "steps": [
            {"label": "Prepare", "duration": 1},
            {"label": "Move gently", "duration": activity["duration"]},
        ],
    }


@app.post("/missions/recommend-session")
def recommend_indoor_session(request: MissionRequest, db: Session = Depends(get_db)):
    """Picks several indoor activities to chain into one guided session,
    filling roughly the requested duration using each activity's real
    step-by-step time (not the duration category)."""
    activities = [activity_to_dict(a) for a in db.query(Activity).all()]

    indoor_activities = [a for a in activities if a["setting"].lower() == "indoor"]
    matching_activities = [a for a in indoor_activities if matches_need(a, request.need)]
    pool = matching_activities if matching_activities else indoor_activities

    random.shuffle(pool)

    target_seconds = request.duration * 60
    selected = []
    total_seconds = 0

    for activity in pool:
        step_seconds = sum(step["seconds"] for step in (activity["steps"] or []))
        if not step_seconds:
            continue

        selected.append(activity)
        total_seconds += step_seconds

        if total_seconds >= target_seconds:
            break

    return {
        "activities": selected,
        "totalSeconds": total_seconds,
    }


def get_team_by_code(join_code: str, db: Session) -> Team:
    team = db.query(Team).filter(Team.join_code == join_code.upper()).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    return team


@app.post("/teams")
def create_team(request: CreateTeamRequest, db: Session = Depends(get_db)):
    team_name = request.teamName.strip()
    if not team_name:
        raise HTTPException(status_code=400, detail="Team name is required")

    # Extremely unlikely to collide, but avoid handing out a code already in use.
    join_code = generate_join_code()
    while db.query(Team).filter(Team.join_code == join_code).first():
        join_code = generate_join_code()

    team = Team(id=uuid.uuid4().hex, name=team_name, join_code=join_code)
    db.add(team)
    db.commit()
    db.refresh(team)

    start_new_season(team, 1, db)

    return {"id": team.id, "name": team.name, "joinCode": team.join_code}


@app.get("/teams")
def list_teams(db: Session = Depends(get_db)):
    """A public, anonymous cross-team leaderboard — team names, member
    counts, and this week's combined points, so people can see how
    different teams stack up. Join codes are never included here:
    finding this list doesn't let you join a team, you still need to
    be given its code directly."""
    rows = []

    for team in db.query(Team).all():
        season = finalize_season_if_ended(get_current_season(team, db), db)
        members = db.query(TeamMember).filter(TeamMember.team_id == team.id).all()

        season_filter = [
            SessionLog.team_id == team.id,
            SessionLog.completed_at >= season.start_at,
            SessionLog.completed_at < season.end_at,
        ]
        totals = dict(
            db.query(SessionLog.member_id, func.sum(SessionLog.seconds))
            .filter(*season_filter)
            .group_by(SessionLog.member_id)
            .all()
        )
        counts = dict(
            db.query(SessionLog.member_id, func.count(SessionLog.id))
            .filter(*season_filter)
            .group_by(SessionLog.member_id)
            .all()
        )

        team_points = sum(
            compute_points(counts.get(member.id, 0), totals.get(member.id, 0))
            for member in members
        )

        rows.append(
            {
                "id": team.id,
                "name": team.name,
                "memberCount": len(members),
                "points": team_points,
                "weekNumber": season.week_number,
            }
        )

    rows.sort(key=lambda row: row["points"], reverse=True)

    return {"teams": rows}


@app.post("/teams/{join_code}/join")
def join_team(join_code: str, request: JoinTeamRequest, db: Session = Depends(get_db)):
    nickname = request.nickname.strip()
    if not nickname:
        raise HTTPException(status_code=400, detail="Nickname is required")

    team = get_team_by_code(join_code, db)

    member = TeamMember(id=uuid.uuid4().hex, team_id=team.id, nickname=nickname)
    db.add(member)
    db.commit()
    db.refresh(member)

    return {
        "memberId": member.id,
        "nickname": member.nickname,
        "team": {"id": team.id, "name": team.name, "joinCode": team.join_code},
    }


@app.post("/teams/{join_code}/leave")
def leave_team(join_code: str, request: LeaveTeamRequest, db: Session = Depends(get_db)):
    team = get_team_by_code(join_code, db)

    member = (
        db.query(TeamMember)
        .filter(TeamMember.id == request.memberId, TeamMember.team_id == team.id)
        .first()
    )
    if not member:
        raise HTTPException(status_code=404, detail="Team member not found")

    db.delete(member)
    db.commit()

    return {"status": "left"}


@app.get("/teams/{join_code}")
def get_team(join_code: str, db: Session = Depends(get_db)):
    team = get_team_by_code(join_code, db)
    member_count = db.query(TeamMember).filter(TeamMember.team_id == team.id).count()

    return {
        "id": team.id,
        "name": team.name,
        "joinCode": team.join_code,
        "memberCount": member_count,
    }


@app.post("/teams/{join_code}/log-session")
def log_session(join_code: str, request: LogSessionRequest, db: Session = Depends(get_db)):
    team = get_team_by_code(join_code, db)

    member = (
        db.query(TeamMember)
        .filter(TeamMember.id == request.memberId, TeamMember.team_id == team.id)
        .first()
    )
    if not member:
        raise HTTPException(status_code=404, detail="Team member not found")

    if request.seconds <= 0:
        raise HTTPException(status_code=400, detail="seconds must be positive")

    log = SessionLog(
        id=uuid.uuid4().hex,
        team_id=team.id,
        member_id=member.id,
        setting=request.setting,
        label=request.label,
        seconds=request.seconds,
    )
    db.add(log)
    db.commit()

    return {"status": "logged"}


@app.get("/teams/{join_code}/leaderboard")
def get_leaderboard(join_code: str, db: Session = Depends(get_db)):
    team = get_team_by_code(join_code, db)
    season = finalize_season_if_ended(get_current_season(team, db), db)

    members = db.query(TeamMember).filter(TeamMember.team_id == team.id).all()

    season_filter = [
        SessionLog.team_id == team.id,
        SessionLog.completed_at >= season.start_at,
        SessionLog.completed_at < season.end_at,
    ]
    totals = dict(
        db.query(SessionLog.member_id, func.sum(SessionLog.seconds))
        .filter(*season_filter)
        .group_by(SessionLog.member_id)
        .all()
    )
    counts = dict(
        db.query(SessionLog.member_id, func.count(SessionLog.id))
        .filter(*season_filter)
        .group_by(SessionLog.member_id)
        .all()
    )
    championships = dict(
        db.query(Season.winner_member_id, func.count(Season.id))
        .filter(Season.team_id == team.id, Season.winner_member_id.isnot(None))
        .group_by(Season.winner_member_id)
        .all()
    )

    rows = []
    for member in members:
        total_seconds = totals.get(member.id, 0)
        sessions_completed = counts.get(member.id, 0)

        rows.append(
            {
                "memberId": member.id,
                "nickname": member.nickname,
                "totalSeconds": total_seconds,
                "sessionsCompleted": sessions_completed,
                "points": compute_points(sessions_completed, total_seconds),
                "championships": championships.get(member.id, 0),
            }
        )
    rows.sort(key=lambda row: row["points"], reverse=True)

    return {
        "team": {"id": team.id, "name": team.name, "joinCode": team.join_code},
        "season": season_to_dict(season),
        "members": rows,
    }


@app.post("/teams/{join_code}/seasons/renew")
def renew_season(join_code: str, db: Session = Depends(get_db)):
    team = get_team_by_code(join_code, db)
    season = finalize_season_if_ended(get_current_season(team, db), db)

    if datetime.now(timezone.utc) < as_utc(season.end_at):
        raise HTTPException(status_code=400, detail="This week hasn't ended yet")

    new_season = start_new_season(team, season.week_number + 1, db)
    return season_to_dict(new_season)
