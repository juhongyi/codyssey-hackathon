import base64
import json

import pytest
from fastapi.testclient import TestClient

from backend import api, interview, planner
from backend.tests.test_interview import recording, settings, summary


@pytest.fixture
def service(monkeypatch, tmp_path):
    monkeypatch.setattr(api.audio, "transcribe", lambda *args: "글을 쓰고 싶어요.")
    monkeypatch.setattr(api.audio, "synthesize", lambda *args: recording())
    monkeypatch.setattr(
        interview,
        "ask_model",
        lambda *args: (
            summary()
            if args[3] is interview.Summary
            else interview.Question(question="어떤 글을 쓰고 싶으세요?", finish=False)
        ),
    )
    app = api.create_app(settings(output=tmp_path, max_questions=2))
    with TestClient(app) as client:
        yield client, tmp_path


def upload(client, session=None):
    query = f"?session_id={session}" if session else ""
    return client.post(
        "/api/turns" + query, content=recording(), headers={"Content-Type": "audio/wav"}
    )


def test_first_turn_followup_and_limit_completion(service, monkeypatch):
    client, root = service
    seen = []

    def generate(client, data):
        seen.append(data)
        return planner.Plan(
            paths=[
                planner.LifePath(
                    kind=kind,
                    title="경로",
                    summary="요약",
                    years=[planner.Year(year=n, direction="탐색") for n in range(1, 6)],
                    first_experiment="글쓰기",
                    assumptions=[],
                )
                for kind in ["current", "alternative", "unconstrained"]
            ]
        )

    monkeypatch.setattr(planner, "generate", generate)
    first = upload(client)
    assert first.status_code == 200
    body = first.json()
    assert body["status"] == "active"
    assert base64.b64decode(body["audio"]) == recording()
    sid = body["session_id"]
    second = upload(client, sid)
    assert second.status_code == 200
    assert second.json()["status"] == "completed"
    data = json.loads((root / sid / "interview.json").read_text())
    assert len(data["exchanges"]) == 2
    assert data["exchanges"][1]["question"] == "어떤 글을 쓰고 싶으세요?"
    assert data["summary"] == summary().model_dump()
    assert len(seen) == 1
    assert (root / sid / "plan.json").exists()
    assert upload(client, sid).status_code == 409


def test_answer_survives_engine_failure(service, monkeypatch):
    client, root = service

    def broken(*args):
        raise ValueError("provider failure")

    monkeypatch.setattr(interview, "ask_model", broken)
    response = upload(client)
    assert response.status_code == 502
    checkpoint = root / response.json()["session_id"] / "interview.json"
    data = json.loads(checkpoint.read_text())
    assert data["exchanges"][0]["answer"] == "글을 쓰고 싶어요."
    assert data["summary"] is None


def test_model_can_finish_before_limit(service, monkeypatch):
    client, root = service
    monkeypatch.setattr(
        interview,
        "ask_model",
        lambda *args: (
            summary()
            if args[3] is interview.Summary
            else interview.Question(question="", finish=True)
        ),
    )

    def broken(*args):
        raise ValueError("planning failed")

    monkeypatch.setattr(planner, "generate", broken)
    response = upload(client)
    assert response.status_code == 502
    path = root / response.json()["session_id"] / "interview.json"
    data = json.loads(path.read_text())
    assert len(data["exchanges"]) == 1
    assert data["summary"] == summary().model_dump()
    assert not path.with_name("plan.json").exists()


def test_tts_failure_preserves_pending_question(service, monkeypatch):
    client, root = service

    def broken(*args):
        raise ValueError("TTS failed")

    monkeypatch.setattr(api.audio, "synthesize", broken)
    response = upload(client)
    assert response.status_code == 502
    path = root / response.json()["session_id"] / "interview.json"
    assert json.loads(path.read_text())["question"] == "어떤 글을 쓰고 싶으세요?"


def test_invalid_and_unknown_sessions(service):
    client, _ = service
    invalid = client.post("/api/turns", content=b"not wav", headers={"Content-Type": "audio/wav"})
    assert invalid.status_code == 400
    assert upload(client, "00000000-0000-0000-0000-000000000000").status_code == 404
    assert upload(client, "../../escape").status_code == 422
