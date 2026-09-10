import os
import random
import secrets
import string
import uuid
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import engine, get_db, Base
from models import Activity, Place, Team, TeamMember, SessionLog

# Creates any tables that don't exist yet (e.g. the team/leaderboard
# tables added after activities/places already existed) without
# touching tables that are already there.
Base.metadata.create_all(bind=engine)

app = FastAPI(title="MoveBreak API")
DEFAULT_ALLOWED_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173"

JOIN_CODE_ALPHABET = "".join(sorted(set(string.ascii_uppercase + string.digits) - set("0O1I")))


def generate_join_code(length: int = 6) -> str:
    return "".join(secrets.choice(JOIN_CODE_ALPHABET) for _ in range(length))


class MissionRequest(BaseModel):
    duration: int = 10
    setting: str = "Indoor"
    need: Optional[str] = None


class CreateTeamRequest(BaseModel):
    teamName: str


class JoinTeamRequest(BaseModel):
    nickname: str


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
    places = db.query(Place).all()
    return [place_to_dict(p) for p in places]


@app.post("/missions/recommend")
def recommend_mission(request: MissionRequest, db: Session = Depends(get_db)):
    activities = [activity_to_dict(a) for a in db.query(Activity).all()]
    places = [place_to_dict(p) for p in db.query(Place).all()]

    setting = request.setting.lower()

    if setting == "outdoor":
        # Pick from all available places so Surprise Me and Try Another can show varied outdoor options.
        place = random.choice(places) if places else None

        return {
            "id": f"{place['id']}-fresh-air-reset" if place else "fresh-air-reset",
            "title": f"{place['name']} Fresh-Air Reset" if place else "Fresh-Air Reset",
            "description": "A short outdoor reset through a nearby open-data location.",
            "duration": min(request.duration, 15),
            "setting": "Outdoor",
            "place": place,
            "steps": [
                {"label": "Walk out", "duration": 4},
                {"label": "Reset", "duration": 2},
                {"label": "Walk back", "duration": 4},
            ],
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

    return {"id": team.id, "name": team.name, "joinCode": team.join_code}


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

    members = db.query(TeamMember).filter(TeamMember.team_id == team.id).all()

    totals = dict(
        db.query(SessionLog.member_id, func.sum(SessionLog.seconds))
        .filter(SessionLog.team_id == team.id)
        .group_by(SessionLog.member_id)
        .all()
    )
    counts = dict(
        db.query(SessionLog.member_id, func.count(SessionLog.id))
        .filter(SessionLog.team_id == team.id)
        .group_by(SessionLog.member_id)
        .all()
    )

    rows = [
        {
            "memberId": member.id,
            "nickname": member.nickname,
            "totalSeconds": totals.get(member.id, 0),
            "sessionsCompleted": counts.get(member.id, 0),
        }
        for member in members
    ]
    rows.sort(key=lambda row: row["totalSeconds"], reverse=True)

    return {
        "team": {"id": team.id, "name": team.name, "joinCode": team.join_code},
        "members": rows,
    }
