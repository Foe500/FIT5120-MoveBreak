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


def test_hybrid_handles_simple_recommendation_locally(monkeypatch):
    monkeypatch.setenv("AI_MODE", "hybrid")
    remote = Mock(side_effect=AssertionError("remote provider should not be called"))
    monkeypatch.setattr(ai_tools.requests, "post", remote)

    name, intent = ai_tools.select_tool(ChatRequest(message="I have 15 minutes and feel tired indoors"), NOW)

    assert name == "local_recommend_break"
    assert intent.availableMinutes == 15
    assert intent.energy == "low"
    assert intent.setting == "Indoor"
    remote.assert_not_called()


def test_hybrid_handles_explicit_plan_locally(monkeypatch):
    monkeypatch.setenv("AI_MODE", "hybrid")
    remote = Mock(side_effect=AssertionError("remote provider should not be called"))
    monkeypatch.setattr(ai_tools.requests, "post", remote)

    name, intent = ai_tools.select_tool(ChatRequest(message="Plan breaks tomorrow from 1-2 pm and 5-6 pm"), NOW)

    assert name == "local_create_plan_preview"
    assert len(intent.windows) == 2
    remote.assert_not_called()


def test_hybrid_sends_complex_language_to_provider(monkeypatch):
    monkeypatch.setenv("AI_MODE", "hybrid")
    monkeypatch.setenv("AI_API_KEY", "test-key")
    remote = Mock(return_value=provider_reply("recommend_break", common_preferences(availableMinutes=10)))
    monkeypatch.setattr(ai_tools.requests, "post", remote)
    request = ChatRequest(message="I've been staring at code all morning. What would help me reset?")

    name, intent = ai_tools.select_tool(request, NOW)

    assert name == "recommend_break"
    assert intent.intent == "recommend"
    assert remote.call_args.kwargs["json"]["tool_choice"] == "required"


def test_hybrid_does_not_resolve_follow_up_references_locally(monkeypatch):
    monkeypatch.setenv("AI_MODE", "hybrid")
    monkeypatch.setenv("AI_API_KEY", "test-key")
    remote = Mock(return_value=provider_reply("ask_clarification", {"language": "en", "question": "Which break should I move?"}))
    monkeypatch.setattr(ai_tools.requests, "post", remote)
    request = ChatRequest(message="Move the second one earlier and keep the first one")

    name, intent = ai_tools.select_tool(request, NOW)

    assert name == "ask_clarification"
    assert intent.clarification == "Which break should I move?"
    remote.assert_called_once()


def test_hybrid_does_not_drop_unknown_activity_requirements(monkeypatch):
    monkeypatch.setenv("AI_MODE", "hybrid")
    monkeypatch.setenv("AI_API_KEY", "test-key")
    remote = Mock(return_value=provider_reply("ask_clarification", {"language": "en", "question": "Would you like a catalog activity instead?"}))
    monkeypatch.setattr(ai_tools.requests, "post", remote)
    request = ChatRequest(message="I need a 15 minute yoga break")

    name, intent = ai_tools.select_tool(request, NOW)

    assert name == "ask_clarification"
    assert intent.intent == "clarify"
    remote.assert_called_once()


def test_hybrid_tool_call_uses_generic_provider_config(monkeypatch):
    monkeypatch.setenv("AI_MODE", "hybrid")
    monkeypatch.setenv("AI_API_KEY", "generic-key")
    monkeypatch.setenv("AI_BASE_URL", "https://provider.example/v1/chat/completions")
    monkeypatch.setenv("AI_MODEL", "provider-model")
    post = Mock(return_value=provider_reply("unsupported_request", {"language": "en"}))
    monkeypatch.setattr(ai_tools.requests, "post", post)

    name, intent = ai_tools.select_tool(ChatRequest(message="Write my database assignment"), NOW)

    assert name == "unsupported_request"
    assert intent.intent == "unsupported"
    assert post.call_args.args[0] == "https://provider.example/v1/chat/completions"
    assert post.call_args.kwargs["headers"]["Authorization"] == "Bearer generic-key"
    assert post.call_args.kwargs["json"]["model"] == "provider-model"
