# MoveBreak AI Break Assistant

This branch adds a global bottom-right chat panel, existing-activity recommendations and a confirmed Planner workflow. Local development can use an explicitly labelled **mock mode**, with no external inference. The recommended production-style setup is **hybrid mode**: narrow, high-confidence requests are parsed locally and complex language falls back to an OpenAI-compatible provider.

## Local setup

Use Python 3.10+ and a Node version supported by the repository's Vite version (Node 22.12+ is suitable). From the repository root:

```sh
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements-dev.txt
npm ci
cp backend/.env.example backend/.env
cd backend
python migrate_json_to_db.py
# Optional for outdoor recommendations; refreshes the local places table from open data:
python build_places_to_db.py
python -m uvicorn main:app --reload --env-file .env
```

The migration resets the **local activities table** to the bundled JSON. Always run database commands and Uvicorn from `backend/`, because the existing SQLite path is relative to the working directory.

In a second terminal, from the repository root:

```sh
npm run dev -- --host 127.0.0.1 --port 5173
```

- Frontend: http://127.0.0.1:5173
- API documentation: http://127.0.0.1:8000/docs
- AI status: http://127.0.0.1:8000/ai/status
- Frontend API base: `VITE_API_BASE_URL`, default `http://127.0.0.1:8000`.
- After initial setup, `bash scripts/start-local.sh` starts both processes. It also supports the bundled runtimes on the current development computer.

## Switching to hybrid AI

Create a provider key yourself; do not put it in chat, Git, frontend code or any `VITE_` variable. Edit the ignored `backend/.env` locally:

```dotenv
AI_MODE=hybrid
AI_PROVIDER=nvidia
AI_BASE_URL=https://integrate.api.nvidia.com/v1/chat/completions
AI_API_KEY=YOUR_KEY_HERE
AI_MODEL=moonshotai/kimi-k3
AI_SIGNING_SECRET=YOUR_LONG_RANDOM_SECRET
```

Generate the signing secret locally with `python -c "import secrets; print(secrets.token_hex(32))"`. Restart the backend after changing the environment. The signing secret must be shared by all workers; without one the prototype creates an in-memory secret and previews expire on restart. No credentials are needed in mock mode. Legacy `AI_MODE=nvidia`, `NVIDIA_API_KEY` and `NVIDIA_MODEL` configuration remains supported.

For the official DeepSeek endpoint, set `AI_PROVIDER=deepseek`, `AI_BASE_URL=https://api.deepseek.com/chat/completions` and a current DeepSeek model. The adapter disables DeepSeek thinking for these structured requests because Hybrid requires exactly one tool call and validates it in a single backend turn.

Hybrid mode keeps explicit, deterministic requests local, including simple duration-based recommendations and fully specified planning windows. Follow-up references, complex free-form language and requests the local parser cannot classify reliably go to the provider. The provider must select exactly one function from `recommend_break`, `create_plan_preview`, `ask_clarification` and `unsupported_request`; its arguments are schema-validated before the existing planning service runs. Provider failures are surfaced, and the system never silently treats a failed AI call as a successful local parse.

Verified provider references:

- https://build.nvidia.com/moonshotai/kimi-k3
- https://docs.api.nvidia.com/nim/reference/llm-apis
- Hosted endpoint: `https://integrate.api.nvidia.com/v1/chat/completions`

Model access, free usage and provider quotas depend on the current NVIDIA account and offering. The app does not assume a guaranteed free tier or 40 requests/minute. Provider 429 responses are surfaced. The prototype additionally caps chat requests at 6/client/minute and 15/process/minute. Before wider deployment use a shared limiter at the gateway (the current in-memory limits are per worker), enforce appropriate API access, and verify the selected model with real calls. The existing site password gate is frontend access control, not authentication for the separate FastAPI server.

## User-facing behaviour

- Up to three **alternative** existing activities; select one. Never combine their durations or imply that all three must be completed.
- Available minutes are a strict maximum, not a target to fill. Custom integer budgets from 1 to 120 minutes are accepted by the new assistant.
- Indoor time uses `ceil(max(catalog duration, sum(step seconds)/60))`. This conservatively accounts for the existing catalog/timer mismatch.
- Explicit low energy filters to catalog intensity `Low`. Body area and posture are hard filters. No match is reported instead of silently relaxing them.
- Indoor is available without a location. Outdoor requires an explicit public starting point selected in the panel; no device location is requested.
- Outdoor time uses conservatively rounded estimated walking time both ways, 3 minutes rest and 2 minutes buffer. Low-energy outdoor results require at most 3 estimated walking minutes each way. These are walking estimates, not a guaranteed real-world return time or verified accessible route.
- These custom budgets are implemented in the new assistant planning service; the existing manual Mission and Explore APIs retain their 5/15/30-minute contract.
- Scheduling proposes one short break per supplied time window (15-minute default maximum per break, or the user's stated maximum), skips occupied intervals and does not fill the entire window.
- Windows that cannot be filled are explicitly counted. Invalid, overlapping or fully elapsed windows prompt clarification. Ambiguous AM/PM must be clarified. Melbourne local dates handle daylight saving.
- Preview start times can be edited within the original availability windows. Activity replacements can be requested through a new preference message; no direct named-activity command execution is implemented.
- Nothing is added until confirmation. The server rechecks signed preview tokens, duration, time window and overlaps; the frontend rechecks the latest browser plan and then saves. A repeated confirmation does not duplicate the same item.
- Plans are stored in **localStorage**, matching the existing code, and survive reload. This intentionally differs from the older sessionStorage requirements draft. No account or server-side Planner persistence was added.
- Conversation stays in page memory and is cleared by reload or Clear chat. In hybrid mode, locally handled requests are not sent to the provider; fallback requests send the user message and bounded recent history. Existing plan times and selected origin are handled by our backend, not included in the model extraction request. Model-generated text is rendered as text, not HTML.
- The assistant interface, replies and clarification questions use English only. Mock mode can still recognize some Chinese sample phrasing, but always replies in English; it is not a general conversational model.
- The initial chat panel has a free-text input and plain-text examples rather than example choice buttons. The outdoor starting-point selector appears only after an outdoor request.
- Assistant replies expose `processing: "local" | "ai"`; the panel labels each answer as `Handled locally` or `AI-assisted` for demo and privacy transparency. AI-assisted replies also expose a display-only allowlisted `toolCall` name, while raw model arguments and tool execution stay on the backend.

## Code ownership and locations

Backend:

- `ai_routes.py`: status/chat/confirmation routes, local rate limiting.
- `ai_schemas.py`: validated request and intent schemas.
- `ai_service.py`: deterministic parser, high-confidence routing gate and generic provider adapter.
- `ai_tools.py`: hybrid routing and the OpenAI-compatible provider tool-calling adapter.
- `break_planning.py`: actual catalog selection, exact budget checks, interval scheduling and signed previews.
- `main.py`: registers the router.

Frontend:

- `src/components/assistant/BreakAssistant.jsx` and `assistant.css`: floating assistant and editable previews.
- `src/lib/assistant.js`: HTTP helper, Melbourne date conversion and client conflict checks.
- `src/lib/plannerStorage.js`: storage notifications and idempotent confirmed adds.
- `src/pages/Planner.jsx`: actual saved plans, dates, editing, deletion, manual indoor additions and guided-break links.
- `src/components/home/TodayPlanCard.jsx`: shows actual saved plans for today.
- `src/App.jsx`: global assistant and enabled Planner navigation.
- `src/pages/Privacy.jsx`: reflects current browser storage and AI data handling.

## API contract

### GET /ai/status

```json
{"mode":"hybrid","available":true,"provider":"nvidia","providerAvailable":true}
```

Modes: `disabled` (default), `mock` (local demo), `hybrid` (local first, provider tool-calling fallback), `provider` (provider JSON extraction for every request) and `nvidia` (legacy alias using tool calling). Hybrid mode remains available for local matches when the key is missing, while complex requests return `AI_NOT_CONFIGURED` instead of being guessed locally.

### POST /ai/chat

```json
{
  "message":"I have 18 minutes and feel tired.",
  "timezone":"Australia/Melbourne",
  "history":[],
  "existingPlan":[],
  "origin":null
}
```

- `message`: nonblank, maximum 2,000 characters.
- `history`: up to 12 entries, `{ "role": "user" | "assistant", "content": "..." }`; frontend sends at most 10.
- `existingPlan`: up to 100 `{ "id": "...", "startAt": "ISO datetime with offset", "endAt": "ISO datetime with offset" }` records. Use `planIntervals()` to normalize browser items; unscheduled legacy items do not reserve a time window.
- `origin`: null or `{ "latitude": -37.815, "longitude": 144.9669 }`.

Response fields:

- `type`: `recommendations`, `plan_preview`, `clarification` or `no_match`.
- `mode`, `processing`, `language`, `timezone`, `reply`: presentation context. `processing` is `local` or `ai`.
- `constraints`: parsed preferences for inspection and debugging.
- `recommendations`: candidates, each with `activityId` or `placeId`, `title`, `setting`, `durationMinutes`, `reason`, `startPath`, `token`. Indoor also includes `detailPath`, `intensity` and `posture`; outdoor includes `origin`, `directionsUrl` and a `breakPlan` for the existing guided route.
- `planItems`: the same candidate data plus `proposalItemId`, `startAt`, `endAt`, `windowStart`, `windowEnd`, `token`.
- `unfilledWindows`: number of windows without a valid slot (planning responses).

Never parse `reply` to determine actions. Use `type`, IDs, dates and arrays. Tokens are opaque, signed, expire after 30 minutes and are never API keys.

### POST /ai/confirm

```json
{
  "items":[{"token":"TOKEN_FROM_CHAT_RESPONSE","startAt":"2026-09-30T13:00:00+10:00"}],
  "existingPlan":[]
}
```

`items` contains 1–6 candidates. Dates above are illustrative; use future dates when testing. `startAt` must include an offset. Return:

```json
{"items":[],"saved":false}
```

Here `items` normally contains newly validated Planner records; it is empty when those proposal IDs are already present in the submitted plan. **`saved:false` is intentional**: the backend does not write browser storage. The frontend calls `addConfirmedPlannerItems()` and only displays success if storage succeeds. An item includes `id`, `activity`, `duration`, `type`, `date`, `time`, `timezone`, `period`, `status`, `iconKey`, `startAt`, `endAt`, plus the underlying activity/place identity and outdoor route data as appropriate.

### Errors

Errors use `{ "detail": { "code": "...", "message": "..." } }`, except FastAPI schema errors, which return the standard 422 validation array.

- 409: `PLAN_CONFLICT`, `OUTSIDE_WINDOW`, `PAST_TIME`, `INVALID_PREVIEW`, `PREVIEW_EXPIRED`, `DURATION_CHANGED`, `DUPLICATE_ITEM`, `ACTIVITY_UNAVAILABLE`, `TIME_LIMIT`.
- 422: invalid request fields/time zone/intervals.
- 429: `AI_RATE_LIMIT`; respect Retry-After where present.
- 502: `AI_UNAVAILABLE`, `AI_INVALID_OUTPUT`.
- 503: `AI_DISABLED`, `AI_NOT_CONFIGURED`.
- 504: `AI_TIMEOUT`.

Frontend retains a failed message for retry. Provider secrets and raw provider error bodies are never sent to the browser.

## Validation

From the repository root:

```sh
PYTHONPATH=backend .venv/bin/python -m pytest backend/tests -q
node --test tests/planner.test.mjs
npm run lint
npm run build
```

Manual examples:

1. “I have 18 minutes and feel tired.” → up to three candidates, each ≤18 min.
2. “I have 8 minutes and prefer indoors.” → English reply and indoor candidates within 8 minutes.
3. “Actually, only 8 minutes, indoors.” → revised budget and retained low energy.
4. “Plan breaks tomorrow from 1–2 pm and 5–6 pm.” → two preview windows; confirm, open Planner, reload.
5. “Plan breaks tomorrow from 1–2 and 5–6.” → AM/PM clarification.
6. “1 minute indoors.” → no match, no budget relaxation.
7. Select a starting point; “18 minutes outdoors.” → estimated round-trip breakdown including buffer, if matching location data is loaded.
8. Create an overlapping plan before confirming a preview → conflict error.
9. Clear plan and reload → stays empty.

The pytest test database is an isolated in-memory SQLite database; tests do not change the developer's activity database. No real NVIDIA inference has been tested without a key. Production credentials, deployment and model behaviour evaluation remain separate from the local demo.
