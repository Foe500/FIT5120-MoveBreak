# MoveBreak Melbourne

MoveBreak is an Iteration 1 web prototype for helping users find short indoor or outdoor breaks around Melbourne CBD.

The project includes a React frontend and a FastAPI backend. The frontend renders the user interface, while the backend provides activity data, map place data, and a basic mission recommendation API.

## Tech Stack

- Frontend: React, Vite, React Router, Tailwind CSS, Leaflet
- Backend: Python, FastAPI
- Data source for Iteration 1: local JSON files in `backend/data`

## Project Structure

```text
backend/
  main.py                 FastAPI app and API routes
  requirements.txt        Python backend dependencies
  data/
    activities.json       Indoor activity data
    places.json           Melbourne CBD place data

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

Start the FastAPI server:

```bash
uvicorn backend.main:app --reload
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

Returns Melbourne CBD place data used by the Home map and Explore Map page.

Example fields:

```json
{
  "id": "flagstaff-gardens",
  "name": "Flagstaff Gardens",
  "type": "Green space",
  "distance": "4 min walk",
  "status": "Best match",
  "position": [-37.8101, 144.955],
  "address": "William Street, West Melbourne"
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
python -m compileall backend
```

Then manually check:

- Home loads and the nearby map markers appear
- Activity Library shows activities from the backend
- Explore Map shows place markers and the result list
- Mission page updates the preview after clicking `Show my options`
- Planner page opens normally
- Backend API documentation opens at `http://127.0.0.1:8000/docs`

## Notes For Iteration 1

- The backend uses JSON files instead of a database for this iteration.
- Planner data is not stored in the backend because the project does not currently include login or user accounts.
- Future iterations can replace JSON files with a database or open data pipeline.
