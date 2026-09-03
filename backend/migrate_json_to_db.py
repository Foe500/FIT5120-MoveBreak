"""
One-time migration script — ACTIVITIES ONLY.
Reads backend/data/activities.json and inserts its contents into the
'activities' table.

Places are NOT handled here on purpose. The 'places' table is loaded
by build_places_to_db.py, which pulls real, live data from the City of
Melbourne APIs. Running both scripts against the places table caused
a real bug once already (this script's old placeholder data silently
overwrote 389 real rows) — so this script now only ever touches
'activities', and build_places_to_db.py is the only thing that ever
touches 'places'.

Run this once after setting up database.py and models.py:
    python backend/migrate_json_to_db.py

Safe to re-run: it clears the activities table before re-inserting, so
you can run it again any time activities.json changes during development.
"""

import json
from pathlib import Path

from database import engine, SessionLocal, Base
from models import Activity

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
