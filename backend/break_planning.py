"""Deterministic constraints. The model cannot choose IDs, times or durations here."""
import base64
import hashlib
import hmac
import json
import math
import os
import secrets
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from urllib.parse import urlencode

from fastapi import HTTPException

from models import Activity, Place
from recommendations import estimate_walking_distance_metres, WALKING_SPEED_METRES_PER_MINUTE

_SIGNING_KEY = os.getenv("AI_SIGNING_SECRET", "").encode() or secrets.token_bytes(32)


def fail(code, message, status=409):
    raise HTTPException(status, detail={"code": code, "message": message})


def sign(payload, now):
    raw = json.dumps({**payload, "expires": (now + timedelta(minutes=30)).timestamp()}, separators=(",", ":"), sort_keys=True).encode()
    encoded = base64.urlsafe_b64encode(raw).decode()
    return encoded + "." + hmac.new(_SIGNING_KEY, encoded.encode(), hashlib.sha256).hexdigest()


def unsign(token, now):
    try:
        encoded, signature = token.rsplit(".", 1)
        if not hmac.compare_digest(signature, hmac.new(_SIGNING_KEY, encoded.encode(), hashlib.sha256).hexdigest()): raise ValueError()
        value = json.loads(base64.urlsafe_b64decode(encoded))
        if value["expires"] <= now.timestamp():
            fail("PREVIEW_EXPIRED", "This preview has expired. Ask the assistant for a new one.")
        return value
    except (ValueError, KeyError, TypeError):
        fail("INVALID_PREVIEW", "This preview is invalid. Please generate it again.")


def duration_minutes(activity):
    # Use the larger of the displayed duration and the full guided timer.
    steps = activity.steps or []
    seconds = sum(float(s.get("seconds", 0)) for s in steps)
    value = max(float(activity.duration or 0), seconds / 60)
    if not math.isfinite(value) or value <= 0: return None
    return math.ceil(value)


def indoor_candidate(activity, budget, intent, zh):
    duration = duration_minutes(activity)
    if duration is None or duration > budget: return None
    if intent.energy == "low" and (activity.intensity or "").lower() != "low": return None
    if intent.area and activity.area != intent.area: return None
    if intent.posture and activity.posture != intent.posture: return None
    reason = f"{duration} 分钟，在 {budget} 分钟以内；剩余时间可留空。" if zh else f"{duration} minutes, within your {budget}-minute limit. You can leave the remaining time free."
    if intent.energy == "low": reason += " 低强度，符合你希望轻松休息的需求。" if zh else " Low intensity matches your request for a gentle break."
    if intent.area: reason += f" Focus: {activity.area}."
    return {"activityId": activity.id, "title": activity.title, "durationMinutes": duration, "setting": "Indoor", "reason": reason,
            "intensity": activity.intensity, "posture": activity.posture,
            "startPath": f"/guided/indoor/{activity.id}", "detailPath": f"/activities/{activity.id}"}


def outdoor_candidate(place, origin, budget, low, zh):
    if place.latitude is None or place.longitude is None: return None
    walk = math.ceil(estimate_walking_distance_metres((origin.latitude, origin.longitude), (place.latitude, place.longitude)) / WALKING_SPEED_METRES_PER_MINUTE)
    walk = max(1, walk)
    if low and walk > 3: return None
    rest, buffer = 3, 2
    total = 2 * walk + rest + buffer
    if total > budget: return None
    directions = "https://www.google.com/maps/dir/?" + urlencode({"api": 1, "origin": f"{origin.latitude},{origin.longitude}", "destination": f"{place.latitude},{place.longitude}", "travelmode": "walking"})
    reason = f"预计总共 {total} 分钟：去程 {walk}、休息 {rest}、返程 {walk}、缓冲 {buffer}。步行时间为估算，请留意实际路况。" if zh else f"Estimated {total} minutes: {walk} there, {rest} rest, {walk} back and {buffer} buffer. Walking times are estimates; check actual conditions."
    return {"placeId": place.id, "title": place.name, "durationMinutes": total, "setting": "Outdoor", "reason": reason,
            "origin": origin.model_dump(), "directionsUrl": directions,
            "breakPlan": {"placeId": place.id, "placeName": place.name, "category": place.category,
                          "walkThereMinutes": walk, "restMinutes": rest, "walkBackMinutes": walk,
                          "bufferMinutes": buffer, "totalMinutes": total, "directionsUrl": directions},
            "startPath": "/guided/outdoor"}


def candidates(db, intent, budget, origin):
    zh = intent.language.startswith("zh")
    items = []
    if intent.setting != "Outdoor":
        for activity in db.query(Activity).filter(Activity.setting == "Indoor").all():
            item = indoor_candidate(activity, budget, intent, zh)
            if item: items.append(item)
    if intent.setting != "Indoor" and origin and not intent.area and not intent.posture:
        for place in db.query(Place).all():
            item = outdoor_candidate(place, origin, budget, intent.energy == "low", zh)
            if item: items.append(item)
    # Match the preference first; unused minutes are not penalised.
    items.sort(key=lambda item: (0 if item.get("intensity", "").lower() == "low" else 1, item["durationMinutes"], item["title"]))
    return items


def parse_local(value, zone):
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo:
        return parsed.astimezone(zone)
    aware = parsed.replace(tzinfo=zone)
    if aware.astimezone(timezone.utc).astimezone(zone).replace(tzinfo=None) != parsed:
        raise ValueError("Nonexistent daylight saving time")
    if aware.utcoffset() != parsed.replace(tzinfo=zone, fold=1).utcoffset():
        raise ValueError("Ambiguous daylight saving time")
    return aware


def overlaps(start, end, existing):
    return any(start < item.endAt and end > item.startAt for item in existing)


def find_slot(start, end, minutes, existing, now):
    cursor = max(start, now.replace(second=0, microsecond=0) + timedelta(minutes=1))
    for item in sorted(existing, key=lambda x: x.startAt):
        if item.endAt <= cursor: continue
        if cursor + timedelta(minutes=minutes) <= item.startAt: break
        if item.startAt < cursor + timedelta(minutes=minutes): cursor = item.endAt
    return cursor if cursor + timedelta(minutes=minutes) <= end else None


def make_result(request, intent, db, now):
    zh = intent.language.startswith("zh")
    result = {"type": "clarification", "language": intent.language, "reply": "", "recommendations": [], "planItems": [],
              "constraints": intent.model_dump(exclude={"clarification"}), "timezone": request.timezone}
    def reply(en, cn):
        result["reply"] = cn if zh else en
        return result
    if intent.intent in ("clarify", "unsupported"):
        return reply(intent.clarification or "I can help find and schedule breaks. Tell me your available time and preferences.", intent.clarification or "我可以帮你推荐和安排休息，请告诉我可用时间和偏好。")
    if intent.setting == "Outdoor" and not request.origin:
        return reply("Choose a starting point below, then send your request again so I can estimate the round trip.", "请先在下方选择出发地点，再发送需求，以便估算往返时间。")
    if intent.setting == "Outdoor" and (intent.area or intent.posture):
        return reply("I cannot verify those body-area or posture requirements for outdoor locations. Would you prefer an indoor activity?", "目前无法验证户外地点是否符合你的部位或姿势要求，是否改选室内活动？")
    if intent.intent == "recommend":
        if intent.availableMinutes is None:
            return reply("How many minutes do you have for this break?", "这次休息你有多少分钟？")
        pool = candidates(db, intent, intent.availableMinutes, request.origin)[:3]
        if not pool:
            result["type"] = "no_match"
            return reply("No existing activity fits all those conditions. Try a different preference or time budget; I won't exceed your limit.", "没有现有活动同时符合这些条件。你可以调整偏好或时间；我不会超过你的时间上限。")
        for item in pool:
            item["token"] = sign({"candidate": item, "budget": intent.availableMinutes, "timezone": request.timezone}, now)
        result.update(type="recommendations", recommendations=pool)
        return reply("Choose one of these activities. Each fits within your time limit; you don't need to fill all the time." + (" These are indoor options; choose a starting point for outdoor suggestions." if intent.setting == "Any" and not request.origin else ""), "从以下活动中选择一个即可，每个都在时间上限内，不需要填满时间。" + ("目前显示室内活动；选择出发地点后可推荐户外活动。" if intent.setting == "Any" and not request.origin else ""))
    if not intent.windows:
        return reply("When are you free? Include the date and AM/PM, for example tomorrow 1–2 pm and 5–6 pm.", "你什么时候有空？请说明日期及上午或下午，例如明天下午 1–2 点和 5–6 点。")
    zone = ZoneInfo(request.timezone)
    windows = []
    try:
        for window in intent.windows:
            start, end = parse_local(window.start, zone), parse_local(window.end, zone)
            if end <= start or end <= now or end - start > timedelta(hours=12): raise ValueError()
            if start.date() != end.date(): raise ValueError()
            windows.append((start, end))
        windows.sort()
        if any(windows[i][0] < windows[i-1][1] for i in range(1, len(windows))): raise ValueError()
    except (ValueError, OverflowError):
        return reply("Please provide valid, non-overlapping future time windows on a single day per window, with AM/PM. Past windows cannot be scheduled.", "请提供有效、不重叠且尚未结束的时间窗口，并说明上午或下午；每个窗口应在同一天内。")
    from ai_schemas import ExistingItem
    existing = list(request.existingPlan)
    missed = 0
    used = set()
    for start, end in windows:
        budget = min(intent.availableMinutes or 15, math.floor((end-start).total_seconds()/60))
        pool = candidates(db, intent, budget, request.origin)
        pool.sort(key=lambda i: (i.get("activityId", i.get("placeId")) in used, i["durationMinutes"]))
        chosen = None
        for candidate in pool:
            slot = find_slot(start, end, candidate["durationMinutes"], existing, now)
            if slot:
                chosen = candidate
                break
        if chosen is None:
            missed += 1
            continue
        finish = slot + timedelta(minutes=chosen["durationMinutes"])
        item_id = secrets.token_hex(12)
        token = sign({"candidate": chosen, "budget": budget, "timezone": request.timezone,
                      "windowStart": start.isoformat(), "windowEnd": end.isoformat(), "proposalItemId": item_id}, now)
        result["planItems"].append({**chosen, "proposalItemId": item_id, "startAt": slot.isoformat(), "endAt": finish.isoformat(),
                                    "windowStart": start.isoformat(), "windowEnd": end.isoformat(), "token": token})
        used.add(chosen.get("activityId", chosen.get("placeId")))
        existing.append(ExistingItem(id=item_id, startAt=slot, endAt=finish))
    result["type"] = "plan_preview" if result["planItems"] else "no_match"
    result["unfilledWindows"] = missed
    return reply("Review these short breaks, one per available window. Change the start times if needed, then confirm to add them. Nothing has been saved yet." + (f" {missed} window(s) could not be filled without breaking your constraints." if missed else ""), "每个空闲窗口安排一次短休息。你可以修改开始时间，确认后再加入 Planner；目前尚未保存。" + (f" 有 {missed} 个时间窗口无法在符合条件的情况下安排。" if missed else ""))


def confirm_plan(request, db, now):
    existing = list(request.existingPlan)
    from ai_schemas import ExistingItem, Origin
    items = []
    ids = set()
    for proposed in request.items:
        signed = unsign(proposed.token, now)
        old = signed["candidate"]
        start = proposed.startAt
        if start <= now: fail("PAST_TIME", "Choose a start time in the future.")
        if old["setting"] == "Indoor":
            activity = db.query(Activity).filter(Activity.id == old["activityId"]).first()
            if not activity: fail("ACTIVITY_UNAVAILABLE", "This activity is no longer available.")
            duration = duration_minutes(activity)
        else:
            place = db.query(Place).filter(Place.id == old["placeId"]).first()
            if not place: fail("ACTIVITY_UNAVAILABLE", "This location is no longer available.")
            fresh = outdoor_candidate(place, Origin(**old["origin"]), signed["budget"], False, False)
            if not fresh: fail("TIME_LIMIT", "This outdoor option no longer fits the time budget.")
            duration = fresh["durationMinutes"]
        if duration is None or duration != old["durationMinutes"] or duration > signed["budget"]:
            fail("DURATION_CHANGED", "The activity duration has changed. Please request a new preview.")
        end = start + timedelta(minutes=duration)
        if signed.get("windowStart") and (start < datetime.fromisoformat(signed["windowStart"]) or end > datetime.fromisoformat(signed["windowEnd"])):
            fail("OUTSIDE_WINDOW", "The entire break must fit inside the original availability window.")
        identity = signed.get("proposalItemId") or hashlib.sha256(proposed.token.encode()).hexdigest()[:24]
        if identity in ids: fail("DUPLICATE_ITEM", "The same activity was submitted twice.")
        ids.add(identity)
        duplicate = next((i for i in existing if i.id == identity), None)
        if duplicate:
            if duplicate.startAt != start or duplicate.endAt != end: fail("DUPLICATE_ITEM", "This item is already saved at a different time.")
            continue
        if overlaps(start, end, existing): fail("PLAN_CONFLICT", "The plan has changed or overlaps another break. Adjust the time and retry.")
        local = start.astimezone(ZoneInfo(signed["timezone"]))
        entry = {"id": identity, "activity": old["title"], "duration": duration, "type": old["setting"],
                 "startAt": start.isoformat(), "endAt": end.isoformat(), "date": local.date().isoformat(),
                 "time": local.strftime("%H:%M"), "timezone": signed["timezone"],
                 "period": "Morning" if local.hour < 12 else "Afternoon", "status": "Start",
                 "iconKey": "CalendarDays" if old["setting"] == "Indoor" else "Footprints", "source": "assistant"}
        for key in ("activityId", "placeId", "directionsUrl", "breakPlan"):
            if key in old: entry[key] = old[key]
        items.append(entry)
        existing.append(ExistingItem(id=identity, startAt=start, endAt=end))
    return {"items": items, "saved": False}
