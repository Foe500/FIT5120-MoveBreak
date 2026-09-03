from typing import Optional
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import Activity, Place

app = FastAPI(title="MoveBreak API")


class MissionRequest(BaseModel):
    duration: int = 10
    setting: str = "Indoor"
    need: Optional[str] = None


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
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
        place = places[0] if places else None
        return {
            "id": "flagstaff-fresh-air-loop",
            "title": "Flagstaff Fresh-Air Loop",
            "description": "A short outdoor reset through nearby greenery.",
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

    activity = matching_activities[0]
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
