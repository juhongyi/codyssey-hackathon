import os
from types import SimpleNamespace
from typing import Any

import psycopg
import pytest
from fastapi.testclient import TestClient
from psycopg import sql
from psycopg.conninfo import make_conninfo

from main import app
from services import providers


@pytest.fixture(scope="session", autouse=True)
def isolated_database():
    from uuid import uuid4

    original = os.environ["DATABASE_URL"]
    name = f"odyssey_test_{uuid4().hex}"
    with psycopg.connect(original, autocommit=True) as admin:
        admin.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(name)))
        os.environ["DATABASE_URL"] = make_conninfo(original, dbname=name)
        try:
            yield
        finally:
            os.environ["DATABASE_URL"] = original
            admin.execute(sql.SQL("DROP DATABASE {} WITH (FORCE)").format(sql.Identifier(name)))


@pytest.fixture
def client(monkeypatch, tmp_path):
    monkeypatch.setenv("AUDIO_STORAGE_PATH", str(tmp_path))
    monkeypatch.setenv("INTERVIEW_MAX_QUESTIONS", "2")
    state = SimpleNamespace(stt_fail=False, question_fail=False, board_fail=False)

    async def transcribe(audio, content_type):
        if state.stt_fail:
            raise RuntimeError("STT unavailable")
        return "My answer"

    async def question(history, max_questions):
        if state.question_fail:
            raise RuntimeError("LLM unavailable")
        return SimpleNamespace(question="What matters?", done=False)

    async def speech(text):
        return b"mp3"

    async def board(history):
        if state.board_fail:
            raise RuntimeError("Planner unavailable")
        return {
            "plans": [
                {
                    "id": key,
                    "label": f"Plan {key}",
                    "title": "Future",
                    "description": "A path",
                    "pieces": [
                        {
                            "id": "piece",
                            "title": "Build",
                            "description": "Try it",
                            "category": "work",
                            "startMonth": 0,
                            "durationMonths": 12,
                            "lane": 0,
                        }
                    ],
                    "scores": {"energy": 5},
                }
                for key in "ABC"
            ]
        }

    monkeypatch.setattr(providers, "transcribe", transcribe)
    monkeypatch.setattr(providers, "next_question", question)
    monkeypatch.setattr(providers, "synthesize", speech)
    monkeypatch.setattr(providers, "generate_board", board)
    with TestClient(app) as api:
        yield api, state, tmp_path


def answer(api, interview, number=None):
    headers = {"Content-Type": "audio/webm"}
    if number is not None:
        headers["X-Question-Number"] = str(number)
    return api.post(f"/api/interviews/{interview['id']}/answers", content=b"audio", headers=headers)


def complete(api):
    interview = api.post("/api/interviews").json()
    for number in (1, 2):
        response = answer(api, interview, number)
        assert response.status_code == 200, response.text
        interview = response.json()
    assert interview["status"] == "completed"
    assert interview["answeredCount"] == 2
    assert interview["question"] is None
    return interview


def test_retries_cap_and_audio_retention(client):
    api, state, storage = client
    interview = api.post("/api/interviews").json()
    assert interview["questionNumber"] == 1
    assert api.get(f"/api/interviews/{interview['id']}/speech").content == b"mp3"
    for failure in ("stt_fail", "question_fail"):
        setattr(state, failure, True)
        assert answer(api, interview, 1).status_code == 502
        assert api.get(f"/api/interviews/{interview['id']}").json()["answeredCount"] == 0
        setattr(state, failure, False)
    assert answer(api, interview, 1).json()["answeredCount"] == 1
    assert answer(api, interview, 1).json()["answeredCount"] == 1
    assert answer(api, interview, 2).json()["status"] == "completed"
    assert answer(api, interview).status_code == 409
    assert len(list(storage.rglob("*.audio"))) >= 3


def test_ownership_board_edits_bounds_and_retention(client):
    api, state, _ = client
    interview = complete(api)
    url = f"/api/interviews/{interview['id']}/board"
    state.board_fail = True
    assert api.post(url).status_code == 502
    assert api.get(f"/api/interviews/{interview['id']}").json()["status"] == "completed"
    state.board_fail = False
    board = api.post(url).json()
    assert api.post(url).json()["id"] == board["id"]
    plan = board["plans"][0]
    edit_url = f"/api/boards/{board['id']}/plans/A"
    plan["pieces"][0]["startMonth"] = 59
    assert api.put(edit_url, json=plan).status_code == 400
    plan["pieces"][0]["durationMonths"] = 1
    assert api.put(edit_url, json=plan).status_code == 200
    second = complete(api)
    assert api.get("/api/boards/current").json()["id"] == board["id"]
    assert api.post(f"/api/interviews/{second['id']}/board").status_code == 200
    assert api.put(edit_url, json=plan).status_code == 200
    api.cookies.clear()
    assert api.get(f"/api/interviews/{interview['id']}").status_code == 404
    assert api.post(url).status_code == 404
    assert api.put(edit_url, json=plan).status_code == 404
    assert api.get("/api/boards/current").status_code == 404


def test_upload_validation(client):
    api, _, _ = client
    interview = api.post("/api/interviews").json()
    url = f"/api/interviews/{interview['id']}/answers"
    assert api.post(url, content=b"text", headers={"Content-Type": "text/plain"}).status_code == 415
    assert api.post(url, content=b"", headers={"Content-Type": "audio/webm"}).status_code == 400
    assert answer(api, interview, 9).status_code == 409


def test_saved_transcript_and_raw_plan(client):
    api, _, _ = client
    interview = complete(api)
    board = api.post(f"/api/interviews/{interview['id']}/board").json()
    with psycopg.connect(os.environ["DATABASE_URL"]) as conn:
        row = conn.execute(
            "SELECT history FROM interviews WHERE id = %s", (interview["id"],)
        ).fetchone()
        assert row is not None
        assert row[0][0]["answer"] == "My answer"
        saved = conn.execute("SELECT raw_plan FROM boards WHERE id = %s", (board["id"],)).fetchone()
        assert saved is not None
        raw = saved[0]
        assert raw["plans"][0]["title"] == "Future"


def test_missing_provider_is_503(client, monkeypatch):
    api, _, _ = client

    async def missing(history, maximum):
        raise RuntimeError("Missing required environment variable: CODYSSEY_API_KEY")

    monkeypatch.setattr(providers, "next_question", missing)
    assert api.post("/api/interviews").status_code == 503


@pytest.mark.parametrize(
    "module,function",
    [
        ("interviewer", "next_question"),
        ("stt", "transcribe"),
        ("tts", "synthesize"),
        ("planner", "generate_board"),
    ],
)
def test_real_agent_missing_credentials_is_503(client, monkeypatch, module, function):
    api, _, _ = client
    interview = complete(api) if module == "planner" else api.post("/api/interviews").json()
    monkeypatch.delenv("CODYSSEY_API_KEY", raising=False)
    monkeypatch.delenv("CLOUDFLARE_ACCOUNT_ID", raising=False)

    async def real_boundary(*args):
        return await providers.invoke(module, function, *args)

    monkeypatch.setattr(providers, function, real_boundary)
    if module in {"interviewer", "stt"}:
        response = answer(api, interview, 1)
    elif module == "tts":
        response = api.get(f"/api/interviews/{interview['id']}/speech")
    else:
        response = api.post(f"/api/interviews/{interview['id']}/board")
    assert response.status_code == 503, response.text
    assert api.get(f"/api/interviews/{interview['id']}").json() == interview


def test_agent_schema_objects_round_trip(client, monkeypatch):
    from agents.schemas import GeneratedBoard, InterviewTurn, Piece, Plan

    api, _, _ = client

    async def question(history, maximum):
        return InterviewTurn(question="What matters?", done=False)

    generated = GeneratedBoard(
        plans=[
            Plan(
                id=key,
                label=label,
                title="Future",
                description="A path",
                pieces=[
                    Piece(
                        id="piece", title="Rest", category="rest", startMonth=59, durationMonths=1
                    )
                ],
            )
            for key, label in (("A", "Plan A"), ("B", "Plan B"), ("C", "Plan C"))
        ]
    )

    async def board(history):
        return generated

    monkeypatch.setattr(providers, "next_question", question)
    monkeypatch.setattr(providers, "generate_board", board)
    interview = complete(api)
    response = api.post(f"/api/interviews/{interview['id']}/board")
    assert response.status_code == 200, response.text
    saved = response.json()
    assert saved["plans"] == [
        {**plan, "scores": {}} for plan in generated.model_dump(by_alias=True)["plans"]
    ]
    assert api.put(f"/api/boards/{saved['id']}/plans/A", json=saved["plans"][0]).status_code == 200


def test_llm_failure_retains_transcript_before_retry(client):
    api, state, storage = client
    interview = api.post("/api/interviews").json()
    state.question_fail = True
    assert answer(api, interview, 1).status_code == 502
    with psycopg.connect(os.environ["DATABASE_URL"]) as conn:
        row = conn.execute(
            "SELECT path, transcript FROM audio_uploads WHERE interview_id = %s",
            (interview["id"],),
        ).fetchone()
        assert row is not None
        assert row[1] == "My answer"
        assert str(next(storage.rglob("*.audio"))) == row[0]
    assert api.get(f"/api/interviews/{interview['id']}").json() == interview
    state.question_fail = False
    assert answer(api, interview, 1).json()["answeredCount"] == 1


def test_original_provider_json_is_stored_before_planner_normalization(client, monkeypatch):
    from copy import deepcopy

    from agents.schemas import GeneratedBoard

    api, _, _ = client
    original: dict[str, Any] = {
        "provider_note": "retain unknown raw fields",
        "plans": [
            {
                "id": key,
                "label": f"Plan {key}",
                "title": "Future",
                "description": "A path",
                "scores": {"confidence": 9},
                "pieces": [
                    {
                        "id": "provider-piece",
                        "title": "Rest",
                        "category": "rest",
                        "startMonth": 0,
                        "durationMonths": 6,
                    }
                ],
            }
            for key in ("C", "B", "A")
        ],
    }
    expected_raw = deepcopy(original)
    for plan in expected_raw["plans"]:
        del plan["scores"]
    generated = GeneratedBoard.model_validate(original)
    generated.plans.sort(key=lambda plan: plan.id)
    for plan in generated.plans:
        plan.pieces[0].id = f"normalized-{plan.id}"

    async def planner(history):
        return generated

    monkeypatch.setattr(providers, "generate_board", planner)
    interview = complete(api)
    response = api.post(f"/api/interviews/{interview['id']}/board")
    assert response.status_code == 200, response.text
    board = response.json()
    assert board["plans"][0]["pieces"][0]["id"] == "normalized-A"
    with psycopg.connect(os.environ["DATABASE_URL"]) as conn:
        saved = conn.execute("SELECT raw_plan FROM boards WHERE id = %s", (board["id"],)).fetchone()
        assert saved is not None
        assert saved[0] == expected_raw
        assert generated.raw_response == original
        assert all(plan["scores"] == {} for plan in board["plans"])


def test_invalid_generation_preserves_existing_board_and_allows_retry(client, monkeypatch):
    api, _, _ = client
    first = complete(api)
    existing = api.post(f"/api/interviews/{first['id']}/board").json()
    second = complete(api)
    planner = providers.generate_board

    async def invalid(history):
        result = await planner(history)
        result["plans"][0]["pieces"][0]["durationMonths"] = 61
        return result

    monkeypatch.setattr(providers, "generate_board", invalid)
    url = f"/api/interviews/{second['id']}/board"
    assert api.post(url).status_code == 502
    assert api.get("/api/boards/current").json() == existing
    assert api.get(f"/api/interviews/{second['id']}").json() == second
    with psycopg.connect(os.environ["DATABASE_URL"]) as conn:
        assert (
            conn.execute(
                "SELECT id FROM boards WHERE interview_id = %s", (second["id"],)
            ).fetchone()
            is None
        )
    monkeypatch.setattr(providers, "generate_board", planner)
    assert api.post(url).status_code == 200


def test_concurrent_duplicate_answers_advance_once(client):
    from concurrent.futures import ThreadPoolExecutor

    api, _, _ = client
    interview = api.post("/api/interviews").json()
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(lambda _: answer(api, interview, 1), range(2)))
    assert all(response.status_code == 200 for response in responses)
    assert api.get(f"/api/interviews/{interview['id']}").json()["answeredCount"] == 1


def test_startup_retains_boards_audio_and_raw_plan(client):
    api, _, storage = client
    interview = complete(api)
    board = api.post(f"/api/interviews/{interview['id']}/board").json()
    files = list(storage.rglob("*.audio"))
    plan = board["plans"][0]
    plan["title"] = "Edited"
    plan["scores"] = {"resources": 0, "confidence": 10}
    assert api.put(f"/api/boards/{board['id']}/plans/A", json=plan).status_code == 200
    with TestClient(app) as restarted:
        restarted.cookies.update(api.cookies)
        retained = restarted.get("/api/boards/current").json()
        assert retained["id"] == board["id"]
        assert retained["plans"][0]["title"] == "Edited"
        assert retained["plans"][0]["scores"] == {"resources": 0, "confidence": 10}
        assert all(path.read_bytes() == b"audio" for path in files)
    with psycopg.connect(os.environ["DATABASE_URL"]) as conn:
        saved = conn.execute("SELECT raw_plan FROM boards WHERE id = %s", (board["id"],)).fetchone()
        assert saved is not None
        raw = saved[0]
        assert raw["plans"][0]["title"] == "Future"


@pytest.mark.parametrize("assessment_first", [True, False])
def test_alternating_assessment_and_piece_saves_survive_reload(client, assessment_first):
    api, _, _ = client
    interview = complete(api)
    board = api.post(f"/api/interviews/{interview['id']}/board").json()
    plan = board["plans"][0]
    url = f"/api/boards/{board['id']}/plans/A"
    edits = ["scores", "pieces"] if assessment_first else ["pieces", "scores"]
    for field in edits:
        if field == "scores":
            plan["scores"] = {"resources": 0, "confidence": 7}
        else:
            plan["pieces"][0].update(
                title="마지막 달 실험", startMonth=59, durationMonths=1, lane=3
            )
        assert api.put(url, json=plan).status_code == 200
        assert api.get("/api/boards/current").json()["plans"][0] == plan
    retained = api.get("/api/boards/current").json()["plans"][0]
    assert retained["scores"] == {"resources": 0, "confidence": 7}
    assert retained["pieces"][0]["startMonth"] == 59
    assert retained["pieces"][0]["lane"] == 3


def test_self_assessment_is_partial_persistent_and_plan_specific(client):
    api, _, _ = client
    interview = complete(api)
    board = api.post(f"/api/interviews/{interview['id']}/board").json()
    assert all(plan["scores"] == {} for plan in board["plans"])
    plan = board["plans"][0]
    url = f"/api/boards/{board['id']}/plans/A"
    for scores in (
        {"resources": 0},
        {"resources": 0, "liking": 10},
        {"resources": 0, "liking": 10, "confidence": 0, "coherence": 10},
    ):
        plan["scores"] = scores
        assert api.put(url, json=plan).status_code == 200
        saved = api.get("/api/boards/current").json()
        assert saved["plans"][0] == plan
        assert saved["plans"][1:] == board["plans"][1:]
    with psycopg.connect(os.environ["DATABASE_URL"]) as conn:
        raw = conn.execute("SELECT raw_plan FROM boards WHERE id = %s", (board["id"],)).fetchone()
        assert raw is not None
        assert all("scores" not in item for item in raw[0]["plans"])


@pytest.mark.parametrize(
    "scores",
    [
        {"resources": -1},
        {"resources": 11},
        {"liking": 1.5},
        {"confidence": "5"},
        {"coherence": True},
        {"resources": None},
        {"energy": 5},
        {"resource": 5},
    ],
)
def test_invalid_self_assessment_is_rejected(client, scores):
    api, _, _ = client
    interview = complete(api)
    board = api.post(f"/api/interviews/{interview['id']}/board").json()
    plan = {**board["plans"][0], "scores": scores}
    assert api.put(f"/api/boards/{board['id']}/plans/A", json=plan).status_code == 400
    assert api.get("/api/boards/current").json() == board
