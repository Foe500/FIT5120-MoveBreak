# MoveBreak Iteration 3 integration guide

This package adds model-informed pedestrian activity ranking and browser-only
recommendation preferences to the existing Iteration 2 branch.

## Current project integration note

This repository integrates the Iteration 3 additions onto the current `develop`
code instead of replacing complete files from the handoff archive. The current
AI assistant, geocoding, break-session tracking, team join approval and rate
limiting remain intact. `models.py`, `database.py` and `build_places_to_db.py`
therefore retain the current project versions.

## Changed files

```text
backend/
├── build_places_to_db.py               existing POI download and ETL
├── database.py                         existing database setup
├── footfall_service.py                 new
├── main.py                             modified
├── models.py                           adds two SQLite footfall tables
├── prepare_footfall_model_assets.py    new validation/install command
├── recommendation_contract.py          new FastAPI response schema
├── recommendations.py                  modified
├── requirements.txt                    modified
└── model/
    └── README.md                       new

src/
├── lib/
│   └── recommendationPreferences.js    new
└── pages/
    ├── ExploreMap.jsx                  modified
    ├── Mission.jsx                     modified
    └── Privacy.jsx                     modified

notebooks/
├── MoveBreak_Iteration3_Footfall_Prediction_Model.ipynb
└── MoveBreak_Iteration3_Footfall_Model_Tuning.ipynb
```

`database.py` and `build_places_to_db.py` retain the current project versions.
`models.py` adds `pedestrian_sensors` and `footfall_profiles` without replacing
the existing team security, join approval or server-authoritative break-session
models. `build_places_to_db.py` remains the original place-data ETL.

## Data download and processing flow

There are two separate data pipelines:

1. `backend/build_places_to_db.py` downloads the five existing City of Melbourne
   place datasets, validates coordinates, normalises categories, deduplicates
   records and rebuilds the `places` table.
2. `notebooks/MoveBreak_Iteration3_Footfall_Prediction_Model.ipynb` downloads and
   validates pedestrian counts, sensor locations and microclimate observations;
   performs time alignment and feature engineering; evaluates the initial model;
   and exports `model_ready_data.csv`. The tuning notebook then performs the
   chronological validation search, final holdout evaluation and model export.

## Install the model and SQLite profile

The notebooks export these paths but the handoff archive does not embed the
generated binary model or CSV files. On the computer or notebook environment
where the modelling notebooks are run, locate:

```text
movebreak_footfall_model_outputs/
├── model_ready_data.csv
└── tuning/
    ├── footfall_model_selected.joblib
    └── final_test_predictions.csv
```

Do not copy the CSV files into the API. Run:

```bash
python backend/prepare_footfall_model_assets.py \
  --outputs-dir /path/to/movebreak_footfall_model_outputs
```

The command validates the model contract, prediction values, sensor IDs and
complete weekday/hour coverage. It aggregates the final-test predictions into
504 compact profiles, replaces only the `pedestrian_sensors` and
`footfall_profiles` rows in `backend/movebreak.db`, copies the Joblib artifact,
and writes `backend/model/asset_manifest.json` with its SHA-256 hash and SQLite
audit counts. The CSV files remain offline modelling evidence.

The API continues to work before these files are copied. Its response will show
`footfall_available: false` and the ranking will use neutral footfall suitability.

## Runtime prediction mode

The selected Random Forest is a rolling one-hour-ahead model and requires recent
pedestrian lags. Website requests therefore query the installed SQLite profile
for the Melbourne weekday and hour. Each request loads the three sensors and the
three relevant profiles once, then reuses them while ranking all candidate
places. The result is labelled historical/model-informed, not live crowd data.

## Install and run

```bash
pip install -r backend/requirements.txt

cd backend
python migrate_json_to_db.py
python build_places_to_db.py
cd ..
python backend/prepare_footfall_model_assets.py \
  --outputs-dir /path/to/movebreak_footfall_model_outputs
cd backend
python -m uvicorn main:app --reload
```

Run the frontend from the repository root:

```bash
npm install
npm run dev
```

Example request:

```text
GET /recommendations?lat=-37.8136&lng=144.9732&break_time=15&limit=20&request_time=2026-10-07T12:00:00+11:00
```

The response includes `contract_version: 1` and is validated against
`RecommendationResponse`. The React client rejects unknown contract versions,
reads `data_status` and `footfall_model`, and only applies the crowd preference
to locations with a usable `footfall_percentile`. When model assets are absent,
the page states that the ranking is using a balanced fallback.

## localStorage contract

The browser key is:

```text
movebreak_recommendation_preferences_v1
```

It stores crowd preference, optional category preferences, a walking-time
preference and at most 20 recent selections. It does not store coordinates,
names, email addresses or health notes. Preferences are applied after the API
has enforced the time-safe filter.

## Integration validation completed

- Python syntax compilation passed.
- Model validation and SQLite installation of 3 sensors and 504 profiles passed.
- Backend fallback ranking contract passed without model files.
- SQLite-backed weekday/hour recommendation contract passed.
- FastAPI exposes and validates the versioned `RecommendationResponse` schema.
- localStorage save/read/re-ranking contract passed.
- Both notebook files passed JSON validation.
- ESLint passed.
- Vite production build passed.

The real model profile still needs to be installed from the notebook outputs;
until then the API and UI continue with the explicit neutral fallback.

The Vite build reports only its existing large-chunk performance warning; it is
not a build failure.
