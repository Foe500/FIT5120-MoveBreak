import json
from datetime import datetime
from unittest.mock import Mock
from zoneinfo import ZoneInfo

import pytest
from fastapi import HTTPException

import ai_tools
from ai_schemas import ChatRequest

NOW = datetime(2026, 10, 2, 12, 0, tzinfo=ZoneInfo("Australia/Melbourne"))


def provider_reply(name, arguments):
    response = Mock()
    response.status_code = 200
    response.raise_for_status = Mock()
    response.json.return_value = {
        "choices": [
            {
                "finish_reason": "tool_calls",
                "message": {
                    "content": None,
                    "tool_calls": [
                        {
                            "id": "call_1",
                            "type": "function",
                            "function": {"name": name, "arguments": json.dumps(arguments)},
                        }
                    ],
                },
            }
        ]
    }
    return response


def common_preferences(**overrides):
    value = {
        "language": "en",
        "availableMinutes": 15,
        "energy": "low",
        "setting": "Indoor",
        "area": None,
        "posture": None,
    }
    value.update(overrides)
    return value


def test_nvidia_recommend_uses_real_tool_call(monkeypatch):
    monkeypatch.setenv("AI_MODE", "nvidia")
    monkeypatch.setenv("NVIDIA_API_KEY", "test-key")
    post = Mock(return_value=provider_reply("recommend_break", common_preferences()))
    monkeypatch.setattr(ai_tools.requests, "post", post)

    name, intent = ai_tools.select_tool(ChatRequest(message="I have 15 minutes and feel tired indoors"), NOW)

    assert name == "recommend_break"
    assert intent.intent == "recommend"
    assert intent.availableMinutes == 15
    assert intent.energy == "low"
    payload = post.call_args.kwargs["json"]
    assert payload["tool_choice"] == "required"
    assert {tool["function"]["name"] for tool in payload["tools"]} == {
        "recommend_break",
        "create_plan_preview",
        "ask_clarification",
        "unsupported_request",
    }


def test_nvidia_plan_tool_validates_windows(monkeypatch):
    monkeypatch.setenv("AI_MODE", "nvidia")
    monkeypatch.setenv("NVIDIA_API_KEY", "test-key")
    args = common_preferences(
        availableMinutes=None,
        setting="Any",
        windows=[
            {"start": "2026-10-03T13:00:00", "end": "2026-10-03T14:00:00"},
            {"start": "2026-10-03T17:00:00", "end": "2026-10-03T18:00:00"},
        ],
    )
    monkeypatch.setattr(ai_tools.requests, "post", Mock(return_value=provider_reply("create_plan_preview", args)))

    name, intent = ai_tools.select_tool(ChatRequest(message="Plan breaks tomorrow 1-2 pm and 5-6 pm"), NOW)

    assert name == "create_plan_preview"
    assert intent.intent == "plan"
    assert len(intent.windows) == 2
    assert intent.windows[0].start == "2026-10-03T13:00:00"


def test_clarification_is_a_tool_not_free_text(monkeypatch):
    monkeypatch.setenv("AI_MODE", "nvidia")
    monkeypatch.setenv("NVIDIA_API_KEY", "test-key")
    reply = provider_reply("ask_clarification", {"language": "en", "question": "How many minutes do you have?"})
    monkeypatch.setattr(ai_tools.requests, "post", Mock(return_value=reply))

    name, intent = ai_tools.select_tool(ChatRequest(message="I need a break"), NOW)

    assert name == "ask_clarification"
    assert intent.intent == "clarify"
    assert intent.clarification == "How many minutes do you have?"


def test_rejects_unknown_or_multiple_tool_calls(monkeypatch):
    monkeypatch.setenv("AI_MODE", "nvidia")
    monkeypatch.setenv("NVIDIA_API_KEY", "test-key")
    monkeypatch.setattr(ai_tools.requests, "post", Mock(return_value=provider_reply("delete_everything", {})))
    with pytest.raises(HTTPException) as exc:
        ai_tools.select_tool(ChatRequest(message="do something"), NOW)
    assert exc.value.detail["code"] == "AI_INVALID_TOOL_CALL"

    response = provider_reply("recommend_break", common_preferences())
    response.json.return_value["choices"][0]["message"]["tool_calls"].append(
        response.json.return_value["choices"][0]["message"]["tool_calls"][0]
    )
    monkeypatch.setattr(ai_tools.requests, "post", Mock(return_value=response))
    with pytest.raises(HTTPException) as exc:
        ai_tools.select_tool(ChatRequest(message="15 minutes"), NOW)
    assert exc.value.detail["code"] == "AI_INVALID_TOOL_CALL"
