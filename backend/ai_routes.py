import threading
import time
from collections import defaultdict, deque
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from database import get_db
from ai_schemas import ChatRequest, ConfirmRequest
from ai_service import api_key, extract, is_remote_mode, localize, mode, provider_name
from ai_tools import select_tool
from break_planning import make_result, confirm_plan

router = APIRouter(prefix="/ai", tags=["AI Break Assistant"])
_lock = threading.Lock()
_requests = defaultdict(deque)


def check_rate_limit(request):
    # Single-process prototype limiter; no trust in spoofable forwarded IP headers.
    with _lock:
        now = time.monotonic()
        for key in list(_requests):
            while _requests[key] and _requests[key][0] < now - 60:
                _requests[key].popleft()
            if not _requests[key]:
                del _requests[key]
        for key, limit in [("global", 15), (request.client.host if request.client else "unknown", 6)]:
            if len(_requests[key]) >= limit:
                raise HTTPException(
                    429,
                    detail={"code": "AI_RATE_LIMIT", "message": "Please wait a minute before sending more messages."},
                    headers={"Retry-After": "60"},
                )
        _requests["global"].append(now)
        _requests[request.client.host if request.client else "unknown"].append(now)


@router.get("/status")
def status():
    current_mode = mode()
    provider_available = is_remote_mode() and bool(api_key())
    configured = current_mode in {"mock", "hybrid"} or provider_available
    return {
        "mode": current_mode,
        "available": configured,
        "provider": provider_name() if is_remote_mode() else None,
        "providerAvailable": provider_available,
    }


@router.post("/chat")
def chat(body: ChatRequest, request: Request, db: Session = Depends(get_db)):
    check_rate_limit(request)
    now = datetime.now(ZoneInfo(body.timezone))
    tool_name, intent = select_tool(body, now)
    result = make_result(body, intent, db, now)
    current_mode = mode()
    result["mode"] = current_mode
    result["processing"] = "local" if current_mode == "mock" or tool_name.startswith("local_") else "ai"
    # Exposed for debugging/testing only. The client does not need to execute it.
    result["toolCall"] = tool_name if current_mode == "nvidia" else None
    return localize(result, intent.language)


@router.post("/confirm")
def confirm(body: ConfirmRequest, db: Session = Depends(get_db)):
    """Revalidate signed suggestions; client persists returned items, not this endpoint."""
    return confirm_plan(body, db, datetime.now(timezone.utc))
