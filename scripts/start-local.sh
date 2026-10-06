#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
REPO_DIR="$PWD"
BUNDLED_NODE="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
if command -v node >/dev/null; then NODE_BIN="$(command -v node)"; else NODE_BIN="$BUNDLED_NODE"; fi
if [ ! -x .venv/bin/python ] || [ ! -f node_modules/vite/bin/vite.js ] || [ ! -x "$NODE_BIN" ]; then
  echo "Complete the setup in docs/ai-assistant-handoff.md first." >&2
  exit 1
fi
if [ ! -f backend/.env ]; then cp backend/.env.example backend/.env; fi
BACKEND_PID=''
FRONTEND_PID=''
cleanup() {
  if [ -n "$BACKEND_PID" ]; then kill "$BACKEND_PID" 2>/dev/null || true; fi
  if [ -n "$FRONTEND_PID" ]; then kill "$FRONTEND_PID" 2>/dev/null || true; fi
}
trap cleanup EXIT INT TERM
(cd backend && exec "$REPO_DIR/.venv/bin/python" -m uvicorn main:app --env-file .env --host 127.0.0.1 --port 8000) &
BACKEND_PID=$!
"$NODE_BIN" node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5173 --strictPort &
FRONTEND_PID=$!
echo "Frontend: http://127.0.0.1:5173   API docs: http://127.0.0.1:8000/docs"
wait "$BACKEND_PID" "$FRONTEND_PID"
