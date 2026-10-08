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
├── models.py                           existing SQLAlchemy models
├── prepare_footfall_model_assets.py    new validation/install command
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

`models.py`, `database.py` and `build_places_to_db.py` are included for a complete
backend handoff but are unchanged. `build_places_to_db.py` is the original
download, cleaning, normalisation and SQLite-loading process for recommendation
places. With only three supported pedestrian sensors, calculating the nearest
sensor at runtime is inexpensive and avoids an unnecessary SQLite migration.

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

## Model and data files that must be copied manually

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

Copy and rename nothing:

```text
backend/model/
├── footfall_model_selected.joblib
├── model_ready_data.csv
└── final_test_predictions.csv
```

The recommended installation command is:

```bash
python backend/prepare_footfall_model_assets.py \
  --outputs-dir /path/to/movebreak_footfall_model_outputs
```

The command validates required columns, timestamps, sensor IDs and the saved
model contract before copying the assets. It also writes
`backend/model/asset_manifest.json` with byte sizes and SHA-256 hashes.

The API continues to work before these files are copied. Its response will show
`footfall_available: false` and the ranking will use neutral footfall suitability.

## Why the API has two prediction modes

The selected Random Forest is a rolling one-hour-ahead model. It requires recent
pedestrian lags and cannot honestly predict an arbitrary current hour using only
a `.joblib` file.

- If the requested historical hour has an exact feature row, the saved model is
  used directly.
- For current website requests, the API uses a weekday/hour profile generated
  from the tuned model's untouched final-test predictions.
- Both outputs are clearly labelled as historical/model-informed rather than a
  live crowd measurement.

## Install and run

```bash
pip install -r backend/requirements.txt

cd backend
python migrate_json_to_db.py
python build_places_to_db.py
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
- Model-asset validation and atomic installation passed with an isolated fixture.
- Backend fallback ranking contract passed without model files.
- localStorage save/read/re-ranking contract passed.
- Both notebook files passed JSON validation.
- ESLint passed.
- Vite production build passed.

Modelled weekday/hour profile inference still needs to be validated after the
three generated model files are supplied.

The Vite build reports only its existing large-chunk performance warning; it is
not a build failure.
