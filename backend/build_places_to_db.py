"""Build the places table directly from City of Melbourne Open Data APIs.

This offline ETL command downloads, filters, cleans, normalises and deduplicates
five datasets before replacing only the ``places`` table. The live FastAPI
request path never reads a CSV file.

Run from backend/:  python build_places_to_db.py
"""

import re
import time

import requests

from database import Base, SessionLocal, engine
from models import Place


API_ROOT = "https://data.melbourne.vic.gov.au/api/explore/v2.1/catalog/datasets"
PAGE_SIZE = 100
LATEST_COMMERCIAL_YEAR = 2024

LANDMARKS_DATASET = (
    "landmarks-and-places-of-interest-including-schools-"
    "theatres-health-services-spor"
)
STREET_FURNITURE_DATASET = (
    "street-furniture-including-bollards-bicycle-rails-bins-"
    "drinking-fountains-horse-"
)
FOUNTAINS_DATASET = "drinking-fountains"
CAFE_DATASET = "cafes-and-restaurants-with-seating-capacity"
BUSINESS_DATASET = "business-establishments-with-address-and-industry-classification"

RELEVANT_LANDMARK_SUB_THEMES = {
    "Informal Outdoor Facility (Park/Garden/Reserve)",
    "Major Sports & Recreation Facility",
}

MARKER_TONES = {
    "park": "green",
    "public_seat": "blue",
    "drinking_fountain": "blue",
    "cafe_restaurant": "gold",
    "supermarket": "gold",
}


def slugify(value):
    """Create a stable URL-safe fragment for generated ids and normalised names."""
    text = str(value or "unknown").lower().strip()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-") or "unknown"


def fetch_all(dataset, where=None):
    """Fetch all pages with retries, avoiding the API's default record limit."""
    url = f"{API_ROOT}/{dataset}/records"
    results = []
    offset = 0

    while True:
        params = {"limit": PAGE_SIZE, "offset": offset}
        if where:
            params["where"] = where

        for attempt in range(3):
            try:
                response = requests.get(url, params=params, timeout=45)
                response.raise_for_status()
                payload = response.json()
                break
            except (requests.RequestException, ValueError) as error:
                if attempt == 2:
                    raise RuntimeError(
                        f"Failed to fetch {dataset} at offset {offset}"
                    ) from error
                time.sleep(2 ** attempt)

        batch = payload.get("results", [])
        results.extend(batch)
        total = int(payload.get("total_count", len(results)))
        offset += PAGE_SIZE
        if not batch or offset >= total:
            break

    print(f"Downloaded {len(results):,} rows from {dataset}")
    return results


def valid_coordinates(latitude, longitude):
    """Accept only numeric latitude and longitude values within geographic bounds."""
    try:
        latitude = float(latitude)
        longitude = float(longitude)
    except (TypeError, ValueError):
        return None
    if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
        return None
    return latitude, longitude


def make_place(record_id, dataset_type, name, category, description, address,
               latitude, longitude, source_dataset):
    """Normalise one source record into the SQLAlchemy Place schema used by recommendations."""
    return Place(
        id=record_id,
        name=name,
        type=category,
        distance=None,
        status="Open data",
        marker=None,
        markerTone=MARKER_TONES.get(dataset_type, "blue"),
        position=[latitude, longitude],
        address=address or None,
        dataset_type=dataset_type,
        category=category,
        description=description or None,
        latitude=latitude,
        longitude=longitude,
        source_dataset=source_dataset,
    )


def build_park_rows():
    """Fetch, filter and normalise public outdoor landmarks into park records."""
    rows = []
    used_ids = set()
    for record in fetch_all(LANDMARKS_DATASET):
        sub_theme = (record.get("sub_theme") or "").strip()
        if sub_theme not in RELEVANT_LANDMARK_SUB_THEMES:
            continue
        name = (record.get("feature_name") or "").strip()
        coordinates = record.get("co_ordinates") or {}
        valid = valid_coordinates(coordinates.get("lat"), coordinates.get("lon"))
        if not name or not valid:
            continue

        record_id = f"park-{slugify(name)}"
        base_id = record_id
        suffix = 2
        while record_id in used_ids:
            record_id = f"{base_id}-{suffix}"
            suffix += 1
        used_ids.add(record_id)
        latitude, longitude = valid
        rows.append(make_place(
            record_id, "park", name, "Outdoor Space", sub_theme,
            # The source supplies coordinates but no street-address field.
            f"{name}, Melbourne VIC", latitude, longitude, LANDMARKS_DATASET,
        ))
    return rows


def build_seat_rows():
    """Fetch street-furniture records and keep public seating with usable coordinates."""
    rows = []
    for record in fetch_all(STREET_FURNITURE_DATASET):
        if (record.get("type") or "").strip().lower() != "seat":
            continue
        valid = valid_coordinates(record.get("latitude"), record.get("longitude"))
        asset_id = str(record.get("assetid") or "").strip()
        if not asset_id or not valid:
            continue
        description = (record.get("description") or "Public Seat").strip()
        name = (record.get("modeldescription") or description).strip()
        latitude, longitude = valid
        rows.append(make_place(
            f"seat-{slugify(asset_id)}", "public_seat", name, "Seat",
            description, (record.get("locationdescription") or "").strip(),
            latitude, longitude, STREET_FURNITURE_DATASET,
        ))
    return rows


def build_fountain_rows():
    """Fetch drinking-fountain records and convert them into amenity recommendations."""
    rows = []
    for record in fetch_all(FOUNTAINS_DATASET):
        coordinates = record.get("geo_point_2d") or {}
        valid = valid_coordinates(coordinates.get("lat"), coordinates.get("lon"))
        asset_id = str(record.get("assetid") or "").strip()
        if not asset_id or not valid:
            continue
        latitude, longitude = valid
        rows.append(make_place(
            f"fountain-{slugify(asset_id)}", "drinking_fountain",
            (record.get("propertyname") or "Drinking Fountain").strip(),
            "Amenity", (record.get("description") or "Drinking Fountain").strip(),
            (record.get("locationdescription") or "").strip(), latitude, longitude,
            FOUNTAINS_DATASET,
        ))
    return rows


def build_cafe_rows():
    """Fetch recent commercial hospitality records suitable for short refresh breaks."""
    records = fetch_all(
        CAFE_DATASET,
        where=f"year(census_year)={LATEST_COMMERCIAL_YEAR}",
    )
    venues = {}
    for record in records:
        name = (record.get("trading_name") or "").strip()
        address = (record.get("business_address") or "").strip()
        property_id = str(record.get("property_id") or "").strip()
        valid = valid_coordinates(record.get("latitude"), record.get("longitude"))
        if not name or not property_id or not valid:
            continue
        latitude, longitude = valid
        key = (property_id, name, address, latitude, longitude)
        venue = venues.setdefault(key, {"indoor": 0, "outdoor": 0})
        try:
            seats = int(float(record.get("number_of_seats") or 0))
        except (TypeError, ValueError):
            seats = 0
        seating_type = (record.get("seating_type") or "").lower()
        if "indoor" in seating_type:
            venue["indoor"] += seats
        elif "outdoor" in seating_type:
            venue["outdoor"] += seats

    rows = []
    for (property_id, name, address, latitude, longitude), seats in venues.items():
        description = (
            f"Cafe or restaurant; indoor seats: {seats['indoor']}; "
            f"outdoor seats: {seats['outdoor']}"
        )
        rows.append(make_place(
            f"cafe-{slugify(property_id)}-{slugify(name)}", "cafe_restaurant",
            name, "Food and Drink", description, address, latitude, longitude,
            CAFE_DATASET,
        ))
    return rows


def build_supermarket_rows():
    """Fetch recent food-shopping records with valid Melbourne CBD coordinates."""
    where = (
        f"year(census_year)={LATEST_COMMERCIAL_YEAR} "
        'AND industry_anzsic4_code="4110"'
    )
    rows = []
    for record in fetch_all(BUSINESS_DATASET, where=where):
        name = (record.get("trading_name") or "").strip()
        property_id = str(record.get("property_id") or "").strip()
        valid = valid_coordinates(record.get("latitude"), record.get("longitude"))
        if not name or not property_id or not valid:
            continue
        latitude, longitude = valid
        rows.append(make_place(
            f"supermarket-{slugify(property_id)}-{slugify(name)}", "supermarket",
            name, "Food Shopping",
            (record.get("industry_anzsic4_description") or
             "Supermarket and Grocery Stores").strip(),
            (record.get("business_address") or "").strip(), latitude, longitude,
            BUSINESS_DATASET,
        ))
    return rows


def deduplicate(rows):
    """Remove duplicate source records while preserving the first normalised place row."""
    return list({row.id: row for row in rows}.values())


def main():
    """Build all place categories, then replace only the places table in one transaction."""
    # Complete network and cleaning work before replacing database data.
    rows = deduplicate(
        build_park_rows() + build_seat_rows() + build_fountain_rows()
        + build_cafe_rows() + build_supermarket_rows()
    )
    counts = {}
    for row in rows:
        counts[row.dataset_type] = counts.get(row.dataset_type, 0) + 1

    db = SessionLocal()
    try:
        # Recreate only Place because its schema now includes normalised fields.
        Place.__table__.drop(bind=engine, checkfirst=True)
        Place.__table__.create(bind=engine, checkfirst=True)
        db.add_all(rows)
        db.commit()
        print("\nInserted place counts:")
        for dataset_type, count in sorted(counts.items()):
            print(f"  {dataset_type}: {count:,}")
        print(f"Total places: {db.query(Place).count():,}")
        print("The live API now reads SQLite and does not read a CSV.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    main()
