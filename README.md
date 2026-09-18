# MoveBreak Melbourne

MoveBreak is a web prototype for helping users find short indoor or outdoor breaks around Melbourne CBD.

The project includes a React frontend and a FastAPI backend. The frontend renders the user interface, while the backend provides activity data, map place data, and a basic mission recommendation API.

## Live Site

The frontend is deployed on Vercel, and the backend API is deployed on Render.

```text
Frontend: https://fit-5120-move-break.vercel.app
Backend:  https://movebreak-api.onrender.com
Health:   https://movebreak-api.onrender.com/health
```

## Tech Stack

- Frontend: React, Vite, React Router, Tailwind CSS, Leaflet
- Backend: Python, FastAPI, SQLite, SQLAlchemy
- Data sources: indoor activities are loaded from local JSON; Melbourne place recommendations are refreshed from City of Melbourne Open Data into SQLite during development or deployment

## Project Structure

```text
backend/
  main.py                 FastAPI app and API routes
  database.py             SQLite connection setup
  models.py               SQLAlchemy database models
  migrate_json_to_db.py   Loads activity data into SQLite
  build_places_to_db.py   Loads Melbourne place data into SQLite
  requirements.txt        Python backend dependencies
  data/
    activities.json       Indoor activity data
    recommendation_places.csv  Legacy fallback place data, no longer used by the live recommendation API

src/
  pages/                  Main React pages
  components/             Reusable React components
  lib/
    api.js                Frontend backend API base URL
    mapMarkers.js         Leaflet marker styling
  data/
    mapPlaces.js          Shared Melbourne map centre and fallback map data
```

## Run The Frontend

Install frontend dependencies:

```bash
npm install
```

Start the Vite development server:

```bash
npm run dev
```

The frontend normally runs at:

```text
http://localhost:5173
```

## Run The Backend

Create and activate a Python virtual environment:

```bash
python -m venv .venv
.venv\Scripts\activate
```

Install backend dependencies:

```bash
pip install -r backend\requirements.txt
```

Initialise or refresh the local SQLite database:

```bash
cd backend
python migrate_json_to_db.py
python build_places_to_db.py
```

`migrate_json_to_db.py` loads indoor activity content from `backend/data/activities.json`.
`build_places_to_db.py` downloads City of Melbourne Open Data and rebuilds only the `places` table. Run it during development setup or deployment refresh, not inside normal user requests.

Start the FastAPI server:

```bash
python -m uvicorn main:app --reload
```

The backend runs at:

```text
http://127.0.0.1:8000
```

FastAPI documentation is available at:

```text
http://127.0.0.1:8000/docs
```

## Backend API

### Health Check

```text
GET /health
```

Returns:

```json
{
  "status": "ok"
}
```

### Activities

```text
GET /activities
```

Returns indoor activity data used by the Activity Library page.

Example fields:

```json
{
  "id": "desk-shoulder-release",
  "area": "Shoulders",
  "title": "Desk shoulder release",
  "description": "Ease tension without leaving your chair.",
  "duration": 3,
  "posture": "Seated",
  "setting": "Indoor",
  "category": "Stretch",
  "intensity": "Low"
}
```

### Places

```text
GET /places
```

Returns Melbourne CBD place data used by the Home map and Explore Map page. The live endpoint reads from SQLite after `python build_places_to_db.py` has refreshed the `places` table.

Example fields:

```json
{
  "id": "flagstaff-gardens",
  "name": "Flagstaff Gardens",
  "record_id": "park-flagstaff-gardens",
  "dataset_type": "park",
  "type": "Outdoor Space",
  "category": "Outdoor Space",
  "description": "Informal Outdoor Facility (Park/Garden/Reserve)",
  "distance": null,
  "status": "Open data",
  "position": [-37.8101, 144.955],
  "address": "Flagstaff Gardens, Melbourne VIC",
  "latitude": -37.8101,
  "longitude": 144.955,
  "source_dataset": "landmarks-and-places-of-interest-including-schools-theatres-health-services-spor"
}
```

### Mission Recommendation

```text
POST /missions/recommend
```

Request body:

```json
{
  "duration": 5,
  "setting": "Indoor",
  "need": "Shoulders"
}
```

Returns a recommended break based on the selected duration, movement setting, and user need.

## Frontend Pages

- Home: dashboard with break controls, recommended mission, and nearby map preview
- Mission: user selects duration, indoor/outdoor preference, and need, then requests a recommendation
- Explore Map: interactive Leaflet map with nearby Melbourne CBD break spots
- Activities: indoor activity library loaded from the backend
- Guides: wellbeing categories for Eyes, Posture, Desk Setup, Movement and Outdoor Break at `/guides`
- Planner: static Iteration 1 break planning interface

## Frontend And Backend Connection

The frontend API base URL is stored in:

```text
src/lib/api.js
```

Current value:

```javascript
export const API_BASE_URL = 'http://127.0.0.1:8000'
```

Current API connections:

```text
Activity Library  -> GET /activities
Explore Map       -> GET /places
Home map preview  -> GET /places
Mission page      -> POST /missions/recommend
```

The backend returns pure data. The frontend keeps UI-specific details such as icons, images, layout, and styling.

## Pre-Deployment Check

run:

```bash
npm run lint
npm run build
cd backend
python migrate_json_to_db.py
python build_places_to_db.py
python -m compileall .
```

Then manually check:

- Home loads and the nearby map markers appear
- Activity Library shows activities from the backend
- Explore Map shows place markers and the result list
- Mission page updates the preview after clicking `Show my options`
- Planner page opens normally
- Backend API documentation opens at `http://127.0.0.1:8000/docs`

## Notes For Iteration 1

- The backend uses a local SQLite database. Activities come from `backend/data/activities.json`; places are refreshed from City of Melbourne Open Data before development demos or deployment.
- Planner data is not stored in the backend because the project does not currently include login or user accounts.
- User-facing recommendation requests read from SQLite and do not call the open-data APIs in real time.
