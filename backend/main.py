import json
from pathlib import Path
from typing import Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="MoveBreak API")
DATA_DIR = Path(__file__).parent / "data"


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


def load_json_file(file_name: str):
    file_path = DATA_DIR / file_name

    with file_path.open(encoding="utf-8") as file:
        return json.load(file)


def matches_need(activity, need):
    if not need:
        return True

    search_text = " ".join(
        [
            activity["area"],
            activity["title"],
            activity["description"],
            activity["category"],
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
def get_activities():
    return load_json_file("activities.json")


@app.get("/places")
def get_places():
    return load_json_file("places.json")


@app.post("/missions/recommend")
def recommend_mission(request: MissionRequest):
    activities = load_json_file("activities.json")
    places = load_json_file("places.json")
    setting = request.setting.lower()

    if setting == "outdoor":
        place = places[0]

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
