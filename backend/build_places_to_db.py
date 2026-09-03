"""
Fetches real records from City of Melbourne open data APIs and inserts
them directly into the 'places' table — no intermediate places.json file.

Requires database.py and models.py (already set up) to be in the same
folder, since this reuses the same Place table/engine.

Sources used:
  - PARKS_API: Landmarks and Places of Interest, filtered to recreation-
    relevant sub-themes only (not the full 242-record dataset).
  - DRINKING_FOUNTAINS_API: has real street addresses, used as a second
    place type ("Amenity").

'distance' and 'status' are stored as NULL on purpose — they depend on
the user's current location and selected duration at request time, so
they must be computed by the backend when a request comes in, not baked
into stored data. See the note printed at the end of this script.

Usage:
    pip3 install requests sqlalchemy
    python3 build_places_to_db.py
"""

import re
import requests

from database import engine, SessionLocal, Base
from models import Place

PARKS_API = (
    "https://data.melbourne.vic.gov.au/api/explore/v2.1/"
    "catalog/datasets/"
    "landmarks-and-places-of-interest-including-schools-"
    "theatres-health-services-spor/records"
)

DRINKING_FOUNTAINS_API = (
    "https://data.melbourne.vic.gov.au/api/explore/v2.1/"
    "catalog/datasets/"
    "drinking-fountains/records"
)

RELEVANT_SUB_THEMES = [
    "Informal Outdoor Facility (Park/Garden/Reserve)",
    "Major Sports & Recreation Facility",
]

TONE_BY_TYPE = {
    "Park/Garden/Reserve": "green",
    "Sports & Recreation Facility": "blue",
    "Amenity": "grey",
}


def slugify(text):
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")


def fetch_all(url, where=None, limit=100):
    results = []
    offset = 0
    while True:
        params = {"limit": limit, "offset": offset}
        if where:
            params["where"] = where
        resp = requests.get(url, params=params, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        batch = data.get("results", [])
        results.extend(batch)
        total = data.get("total_count", len(results))
        offset += limit
        if offset >= total or not batch:
            break
    return results


def build_park_rows():
    where_clause = " OR ".join(f'sub_theme="{t}"' for t in RELEVANT_SUB_THEMES)
    records = fetch_all(PARKS_API, where=where_clause)

    rows = []
    seen_ids = set()
    for i, r in enumerate(records, start=1):
        name = r.get("feature_name")
        coords = r.get("co_ordinates")
        if not name or not coords:
            continue

        base_id = slugify(name)
        entry_id = base_id
        suffix = 2
        while entry_id in seen_ids:
            entry_id = f"{base_id}-{suffix}"
            suffix += 1
        seen_ids.add(entry_id)

        sub_theme = r.get("sub_theme", "")
        place_type = (
            "Sports & Recreation Facility"
            if "Sports" in sub_theme
            else "Park/Garden/Reserve"
        )

        rows.append(Place(
            id=entry_id,
            name=name,
            type=place_type,
            distance=None,
            status=None,
            marker=str(i),
            markerTone=TONE_BY_TYPE[place_type],
            position=[coords["lat"], coords["lon"]],
            address=None,
        ))
    return rows


def build_fountain_rows(start_marker):
    records = fetch_all(DRINKING_FOUNTAINS_API)

    rows = []
    seen_ids = set()
    for i, r in enumerate(records, start=start_marker):
        location_desc = r.get("locationdescription")
        geo = r.get("geo_point_2d")
        if not geo:
            continue

        name = r.get("propertyname") or "Drinking Fountain"
        base_id = slugify(f"{name}-{r.get('assetid', i)}")
        entry_id = base_id
        suffix = 2
        while entry_id in seen_ids:
            entry_id = f"{base_id}-{suffix}"
            suffix += 1
        seen_ids.add(entry_id)

        rows.append(Place(
            id=entry_id,
            name=name,
            type="Amenity",
            distance=None,
            status=None,
            marker=str(i),
            markerTone=TONE_BY_TYPE["Amenity"],
            position=[geo["lat"], geo["lon"]],
            address=location_desc,
        ))
    return rows


def main():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        park_rows = build_park_rows()
        print(f"Fetched {len(park_rows)} recreation-relevant landmarks")

        fountain_rows = build_fountain_rows(start_marker=len(park_rows) + 1)
        print(f"Fetched {len(fountain_rows)} drinking fountains")

        # Clear existing places so re-runs don't duplicate rows
        db.query(Place).delete()
        db.add_all(park_rows + fountain_rows)
        db.commit()

        total = db.query(Place).count()
        print(f"\nInserted {total} rows into the places table.")
        print("\nNOTE: 'distance' and 'status' are NULL for every row on purpose.")
        print("They depend on the user's location + selected duration, so they")
        print("must be computed in the backend when a request comes in — e.g.")
        print("in /missions/recommend or a /places endpoint that accepts the")
        print("user's lat/lng — not stored as fixed values here.")
    except Exception as e:
        db.rollback()
        print(f"Failed, rolled back: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
