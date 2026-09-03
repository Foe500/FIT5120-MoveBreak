"""
One-time migration script.
Reads backend/data/activities.json and backend/data/places.json,
inserts their contents into the SQLite database as rows.

Run this once after setting up database.py and models.py:
    python backend/migrate_json_to_db.py

Safe to re-run: it clears each table before re-inserting, so you can
run it again any time the JSON files change during development.
"""

import json
from pathlib import Path

from database import engine, SessionLocal, Base
from models import Activity, Place

DATA_DIR = Path(__file__).parent / "data"


def load_json(filename):
    path = DATA_DIR / filename
    if not path.exists():
        print(f"  Skipped: {filename} not found at {path}")
        return []
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def migrate():
    # Create tables if they don't exist yet
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # --- Activities ---
        activities_data = load_json("activities.json")
        db.query(Activity).delete()
        for entry in activities_data:
            db.add(Activity(
                id=entry["id"],
                area=entry["area"],
                title=entry["title"],
                description=entry["description"],
                duration=entry["duration"],
                posture=entry["posture"],
                setting=entry["setting"],
                category=entry["category"],
                intensity=entry["intensity"],
                imageUrl=entry.get("imageUrl"),  # optional field
            ))
        print(f"  Inserted {len(activities_data)} activities")

        # --- Places ---
        places_data = load_json("places.json")
        db.query(Place).delete()
        for entry in places_data:
            db.add(Place(
                id=entry["id"],
                name=entry["name"],
                type=entry["type"],
                distance=entry.get("distance"),
                status=entry.get("status"),
                marker=entry.get("marker"),
                markerTone=entry.get("markerTone"),
                position=entry["position"],
                address=entry.get("address"),
            ))
        print(f"  Inserted {len(places_data)} places")

        db.commit()
        print("Migration complete.")
    except Exception as e:
        db.rollback()
        print(f"Migration failed, rolled back: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    migrate()
