import json
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo
from unittest.mock import Mock

import pytest
import requests
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import ai_service
from ai_routes import router, _requests
from ai_schemas import ChatRequest, ConfirmRequest, ExistingItem, Intent
from break_planning import make_result, confirm_plan, parse_local, unsign
from database import Base, get_db
from models import Activity, Place

NOW = datetime(2026, 9, 29, 9, 0, tzinfo=ZoneInfo('Australia/Melbourne'))

@pytest.fixture
def db():
    engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    data = json.loads((Path(__file__).parents[1] / 'data/activities.json').read_text())
    columns = {c.name for c in Activity.__table__.columns}
    session.add_all([Activity(**{k: v for k, v in row.items() if k in columns}) for row in data])
    session.add(Place(id='test-park', name='Test Park', latitude=-37.815, longitude=144.967,
                      type='Outdoor Space', status='Open data', category='Park', dataset_type='park', position=[-37.815,144.967], source_dataset='test'))
    session.commit()
    yield session
    session.close(); engine.dispose()

@pytest.fixture(autouse=True)
def mock_mode(monkeypatch):
    monkeypatch.setenv('AI_MODE', 'mock')
    _requests.clear()


def result(db, message, **kwargs):
    body = ChatRequest(message=message, **kwargs)
    return make_result(body, ai_service.extract(body, NOW), db, NOW)


def test_18_minute_candidates_are_real_and_low(db):
    response = result(db, 'I have 18 minutes and feel very tired.')
    assert response['type'] == 'recommendations'
    assert len(response['recommendations']) == 3
    for item in response['recommendations']:
        a = db.get(Activity, item['activityId'])
        assert a.intensity == 'Low'
        assert item['durationMinutes'] <= 18
        assert item['durationMinutes'] * 60 >= sum(s['seconds'] for s in a.steps)
        assert unsign(item['token'], NOW)['budget'] == 18


def test_real_timer_not_just_label(db):
    for a in db.query(Activity).all(): a.steps = [{'seconds': 19 * 60}]
    db.commit()
    assert result(db, '18 minutes indoor')['type'] == 'no_match'


def test_exact_limit_and_no_match(db):
    response = result(db, '5 minutes indoor')
    assert all(x['durationMinutes'] <= 5 for x in response['recommendations'])
    assert result(db, '1 minute indoor')['type'] == 'no_match'


def test_chinese_and_follow_up(db):
    response = result(db, '其实只有8分钟，想待在室内', history=[{'role':'user','content':'我有18分钟，今天很累'}])
    assert response['language'] == 'zh'
    assert response['constraints']['energy'] == 'low'
    assert response['constraints']['availableMinutes'] == 8
    assert all(i['durationMinutes'] <= 8 for i in response['recommendations'])


def test_missing_and_ambiguous(db):
    assert result(db, 'I am tired')['type'] == 'clarification'
    assert result(db, 'Plan breaks today from 1-2 and 5-6')['type'] == 'clarification'
    assert result(db, 'Plan today 2-1 pm')['type'] == 'clarification'
    assert result(db, 'Plan today 7-8 am')['type'] == 'clarification'
    assert result(db, '18 minutes outdoors')['type'] == 'clarification'


def test_outdoor_custom_budget(db):
    response = result(db, '18 minutes outdoors', origin={'latitude': -37.815, 'longitude': 144.967})
    assert response['type'] == 'recommendations'
    for item in response['recommendations']:
        p = item['breakPlan']
        assert sum(p[k] for k in ('walkThereMinutes','restMinutes','walkBackMinutes','bufferMinutes')) == item['durationMinutes'] <= 18


def test_plans_fit_windows_and_avoid_existing(db):
    existing = [{'id':'meeting', 'startAt':'2026-09-29T13:00:00+10:00','endAt':'2026-09-29T13:30:00+10:00'}]
    response = result(db, 'Plan breaks today from 1-2 pm and 5-6 pm', existingPlan=existing)
    assert response['type'] == 'plan_preview'
    assert len(response['planItems']) == 2
    assert response['planItems'][0]['startAt'].endswith('13:30:00+10:00')
    for item in response['planItems']:
        assert datetime.fromisoformat(item['windowStart']) <= datetime.fromisoformat(item['startAt'])
        assert datetime.fromisoformat(item['endAt']) <= datetime.fromisoformat(item['windowEnd'])
    request = ConfirmRequest(items=[{'token':i['token'],'startAt':i['startAt']} for i in response['planItems']], existingPlan=existing)
    confirmation = confirm_plan(request, db, NOW)
    assert len(confirmation['items']) == 2
    assert confirmation['saved'] is False
    saved = [ExistingItem(id=i['id'], startAt=i['startAt'], endAt=i['endAt']) for i in confirmation['items']]
    request.existingPlan += saved
    assert confirm_plan(request, db, NOW)['items'] == []


def test_confirm_rechecks_conflict_window_and_token(db):
    item = result(db, 'Plan today 1-2 pm')['planItems'][0]
    for overrides, code in [({'startAt':'2026-09-29T14:00:00+10:00'}, 'OUTSIDE_WINDOW'), ({'token':item['token']+'x'}, 'INVALID_PREVIEW')]:
        request = ConfirmRequest(items=[{'token':item['token'],'startAt':item['startAt'], **overrides}])
        with pytest.raises(HTTPException) as exc: confirm_plan(request, db, NOW)
        assert exc.value.detail['code'] == code
    request = ConfirmRequest(items=[{'token':item['token'],'startAt':item['startAt']}], existingPlan=[{'id':'new','startAt':item['startAt'],'endAt':item['endAt']}])
    with pytest.raises(HTTPException) as exc: confirm_plan(request, db, NOW)
    assert exc.value.detail['code'] == 'PLAN_CONFLICT'
    with pytest.raises(HTTPException) as exc: confirm_plan(ConfirmRequest(items=[{'token':item['token'],'startAt':item['startAt']}]), db, NOW + timedelta(minutes=31))
    assert exc.value.detail['code'] == 'PREVIEW_EXPIRED'


def test_confirm_rechecks_changed_activity(db):
    item = result(db, '18 minutes')['recommendations'][0]
    activity = db.get(Activity, item['activityId']); activity.duration = 40; db.commit()
    with pytest.raises(HTTPException) as exc:
        confirm_plan(ConfirmRequest(items=[{'token': item['token'], 'startAt':'2026-09-29T14:00:00+10:00'}]), db, NOW)
    assert exc.value.detail['code'] == 'DURATION_CHANGED'


def test_dst_gap_and_fold():
    zone = ZoneInfo('Australia/Melbourne')
    for value in ['2026-10-04T02:30:00', '2027-04-04T02:30:00']:
        with pytest.raises(ValueError): parse_local(value, zone)


def test_http_contract_and_limits(db):
    app = FastAPI(); app.include_router(router)
    app.dependency_overrides[get_db] = lambda: db
    client = TestClient(app)
    assert client.get('/ai/status').json()['mode'] == 'mock'
    assert client.post('/ai/chat', json={'message':'18 minutes'}).json()['type'] == 'recommendations'
    for payload in [{'message':' '}, {'message':'x'*2001}, {'message':'18 minutes', 'timezone':'not/a/timezone'}, {'message':'18 minutes','origin':{'latitude':100,'longitude':0}}]:
        assert client.post('/ai/chat', json=payload).status_code == 422
    for _ in range(5): assert client.post('/ai/chat', json={'message':'18 minutes'}).status_code == 200
    assert client.post('/ai/chat', json={'message':'18 minutes'}).status_code == 429


def test_nvidia_adapter_failure_and_structured_output(monkeypatch):
    monkeypatch.setenv('AI_MODE','nvidia'); monkeypatch.setenv('NVIDIA_API_KEY','test-not-a-real-key')
    mock = Mock()
    mock.status_code = 200
    mock.json.return_value = {'choices':[{'finish_reason':'stop','message':{'content':json.dumps(Intent(availableMinutes=18, energy='low').model_dump())}}]}
    post = Mock(return_value=mock); monkeypatch.setattr(ai_service.requests,'post',post)
    parsed = ai_service.extract(ChatRequest(message='18 minutes tired'), NOW)
    assert parsed.availableMinutes == 18
    assert post.call_args.kwargs['timeout'] == (5,45)
    mock.json.return_value = {'choices':[{'message':{'content':'not JSON'}}]}
    with pytest.raises(HTTPException) as exc: ai_service.extract(ChatRequest(message='hi'), NOW)
    assert exc.value.status_code == 502
    post.side_effect = requests.Timeout()
    with pytest.raises(HTTPException) as exc: ai_service.extract(ChatRequest(message='hi'), NOW)
    assert exc.value.status_code == 504


def test_mock_date_correction_and_bare_duration(db):
    response = result(db, '今天下午1-2点帮我安排休息', history=[{'role':'user','content':'明天下午1-2点帮我安排休息'}])
    assert response['planItems'][0]['startAt'].startswith('2026-09-29')
    response = result(db, '8', history=[{'role':'user','content':'I am tired'}])
    assert response['constraints']['availableMinutes'] == 8
    assert all(i['durationMinutes'] <= 8 for i in response['recommendations'])


def test_mock_explicit_calendar_date(db):
    response = result(db, 'Plan 2026-09-30 from 1-2 pm and 5-6 pm')
    assert len(response['planItems']) == 2
    assert response['planItems'][0]['startAt'].startswith('2026-09-30')


def test_mock_chinese_afternoon_schedule(db):
    response = result(db, '明天下午1-2点、5-6点有空，帮我安排休息')
    assert len(response['planItems']) == 2
    assert response['language'] == 'zh'
    assert 'T13:' in response['planItems'][0]['startAt']
    assert 'T17:' in response['planItems'][1]['startAt']


def test_new_recommendation_does_not_reuse_old_planning_intent(db):
    response = result(db, 'I have 18 minutes and feel tired.', history=[
        {'role': 'user', 'content': 'Plan tomorrow from 1-2 pm'},
        {'role': 'assistant', 'content': 'Review this plan preview.'},
    ])
    assert response['type'] == 'recommendations'
    assert response['constraints']['availableMinutes'] == 18
