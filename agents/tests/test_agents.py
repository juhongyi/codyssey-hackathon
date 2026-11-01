import asyncio
import base64
import json
from copy import deepcopy
from uuid import UUID

import httpx
import pytest
from pydantic import ValidationError

from agents import interviewer, llm, planner, stt, tts
from agents.schemas import GeneratedBoard, InterviewTurn, Piece


def run(awaitable):
    return asyncio.run(awaitable)


@pytest.fixture(autouse=True)
def environment(monkeypatch):
    for name in (
        "CODYSSEY_API_KEY",
        "CLOUDFLARE_ACCOUNT_ID",
        "CLOUDFLARE_API_TOKEN",
        "INTERVIEWER_LLM_MODEL",
        "PLANNER_LLM_MODEL",
        "CODYSSEY_TTS_MODEL",
        "CODYSSEY_TTS_VOICE",
        "WORKERS_AI_STT_MODEL",
    ):
        monkeypatch.delenv(name, raising=False)


@pytest.fixture
def mock_http(monkeypatch):
    original = httpx.AsyncClient

    def install(handler):
        transport = httpx.MockTransport(handler)
        monkeypatch.setattr(
            httpx, "AsyncClient", lambda **kwargs: original(transport=transport, **kwargs)
        )

    return install


def board_data():
    return {
        "plans": [
            {
                "id": plan_id,
                "label": f"Plan {plan_id}",
                "title": f"나의 미래 {plan_id}",
                "description": "가치를 반영한 5년 계획",
                "pieces": [
                    {
                        "id": "duplicate",
                        "title": f"작은 실험 {plan_id}",
                        "category": "work",
                        "startMonth": 0,
                        "durationMonths": 6,
                    }
                ],
            }
            for plan_id in "ABC"
        ]
    }


def chat_response(content):
    return httpx.Response(200, json={"choices": [{"message": {"content": content}}]})


def test_first_question_and_cap_need_no_credentials():
    first = run(interviewer.next_question([], 10))
    assert first.question and "?" in first.question and not first.done
    assert run(interviewer.next_question([], 10)) == first
    assert run(interviewer.next_question([{"question": "q", "answer": "a"}], 1)) == (
        InterviewTurn(question=None, done=True)
    )
    assert run(interviewer.next_question([], 0)).done


@pytest.mark.parametrize(
    "data",
    [
        {"question": "", "done": False},
        {"question": "  ", "done": False},
        {"question": None, "done": False},
        {"question": "질문?", "done": True},
    ],
)
def test_interview_turn_rejects_inconsistent_output(data):
    with pytest.raises(ValidationError):
        InterviewTurn.model_validate(data)


def test_interviewer_http_contract_and_early_finish(monkeypatch, mock_http):
    monkeypatch.setenv("CODYSSEY_API_KEY", "test-key")
    history = [{"question": "무엇이 중요한가요?", "answer": "자율성"}]

    def handle(request):
        assert str(request.url) == "https://copa.codyssey.kr/v1/chat/completions"
        assert request.headers["authorization"] == "Bearer test-key"
        body = json.loads(request.content)
        assert body["model"] == "claude-haiku-4"
        assert "자율성" in body["messages"][-1]["content"]
        assert "JSON" in body["messages"][0]["content"]
        return chat_response('```json\n{"question": null, "done": true}\n```')

    mock_http(handle)
    assert run(interviewer.next_question(history, 10)).done


def test_interviewer_override_and_one_validation_retry(monkeypatch, mock_http):
    monkeypatch.setenv("CODYSSEY_API_KEY", "test-key")
    monkeypatch.setenv("INTERVIEWER_LLM_MODEL", "custom-interviewer")
    requests = []

    def handle(request):
        body = json.loads(request.content)
        requests.append(body)
        assert body["model"] == "custom-interviewer"
        return chat_response(
            json.dumps(
                {"question": "" if len(requests) == 1 else "언제 행복했나요?", "done": False}
            )
        )

    mock_http(handle)
    assert run(interviewer.next_question([{"question": "q", "answer": "a"}], 10)).question
    assert len(requests) == 2
    assert len(requests[1]["messages"]) > len(requests[0]["messages"])


def test_planner_contract_and_unique_uuid_ids(monkeypatch, mock_http):
    monkeypatch.setenv("CODYSSEY_API_KEY", "test-key")

    def handle(request):
        body = json.loads(request.content)
        assert body["model"] == "gpt-5.5"
        assert request.extensions["timeout"]["read"] == 180
        assert "자율성" in body["messages"][-1]["content"]
        assert "JSON" in body["messages"][0]["content"]
        return chat_response(json.dumps(board_data(), ensure_ascii=False))

    mock_http(handle)
    board = run(planner.generate_board([{"question": "가치?", "answer": "자율성"}]))
    assert [plan.id for plan in board.plans] == list("ABC")
    ids = [piece.id for plan in board.plans for piece in plan.pieces]
    assert len(set(ids)) == 3
    assert all(str(UUID(piece_id)) == piece_id for piece_id in ids)
    assert "scores" not in board.plans[0].model_dump()
    assert "scores" not in GeneratedBoard.model_json_schema()["$defs"]["Plan"]["properties"]
    assert "createdAt" not in board.model_dump()


def test_planner_override_and_bounded_invalid_json_retry(monkeypatch, mock_http):
    monkeypatch.setenv("CODYSSEY_API_KEY", "test-key")
    monkeypatch.setenv("PLANNER_LLM_MODEL", "custom-planner")
    calls = []

    def handle(request):
        calls.append(request)
        assert json.loads(request.content)["model"] == "custom-planner"
        return chat_response("not JSON")

    mock_http(handle)
    with pytest.raises(ValueError, match="valid"):
        run(planner.generate_board([]))
    assert len(calls) == 2


def test_planner_preserves_original_provider_json(monkeypatch, mock_http):
    monkeypatch.setenv("CODYSSEY_API_KEY", "test-key")
    original = board_data()
    original["plans"].reverse()
    original["provider_notes"] = {"values": ["자율성"]}
    original["plans"][0]["pieces"][0]["provider_detail"] = "원본"
    mock_http(lambda request: chat_response(json.dumps(original, ensure_ascii=False)))

    board = run(planner.generate_board([]))

    raw = board.raw_response
    assert raw == original
    assert raw is not None
    assert [plan.id for plan in board.plans] == list("ABC")
    assert all(piece.id != "duplicate" for plan in board.plans for piece in plan.pieces)
    assert "scores" not in raw["plans"][0]
    assert "lane" not in raw["plans"][0]["pieces"][0]
    assert "raw_response" not in board.model_dump()
    assert "_raw_response" not in board.model_dump()
    assert "provider_notes" not in board.model_dump()
    assert "raw_response" not in json.dumps(GeneratedBoard.model_json_schema())


def test_raw_response_is_a_deep_snapshot_of_validation_input():
    original = board_data()
    expected = deepcopy(original)
    board = GeneratedBoard.model_validate(original)

    original["plans"][0]["pieces"][0]["title"] = "입력 변경"
    board.plans[0].pieces[0].title = "편집 변경"
    assert board.raw_response == expected
    exposed = board.raw_response
    assert exposed is not None
    exposed["plans"].clear()
    assert board.raw_response == expected


@pytest.mark.parametrize(
    "changes",
    [
        {"startMonth": -1},
        {"startMonth": 60},
        {"durationMonths": 0},
        {"durationMonths": 61},
        {"startMonth": 59, "durationMonths": 2},
        {"lane": -1},
        {"lane": 4},
        {"category": "other"},
    ],
)
def test_piece_bounds(changes):
    data = board_data()["plans"][0]["pieces"][0] | changes
    with pytest.raises(ValidationError):
        Piece.model_validate(data)


def test_piece_defaults_and_last_month_boundary():
    piece = Piece(id="p", title="휴식", category="rest", startMonth=59, durationMonths=1)
    assert piece.lane == 0
    assert piece.description == ""


@pytest.mark.parametrize("mutation", ["missing", "duplicate", "label", "unknown"])
def test_board_requires_three_correct_plans(mutation):
    data = board_data()
    if mutation == "missing":
        data["plans"].pop()
    elif mutation == "duplicate":
        data["plans"][1] = data["plans"][0]
    elif mutation == "label":
        data["plans"][0]["label"] = "Plan B"
    else:
        data["plans"][0]["id"] = "D"
    with pytest.raises(ValidationError):
        GeneratedBoard.model_validate(data)


@pytest.mark.parametrize(
    "operation,key",
    [
        (
            lambda: interviewer.next_question([{"question": "q", "answer": "a"}], 10),
            "CODYSSEY_API_KEY",
        ),
        (lambda: planner.generate_board([]), "CODYSSEY_API_KEY"),
        (lambda: tts.synthesize("안녕하세요"), "CODYSSEY_API_KEY"),
        (lambda: stt.transcribe(b"audio", "audio/webm"), "CLOUDFLARE_ACCOUNT_ID"),
    ],
)
def test_missing_credentials_are_clear(operation, key):
    with pytest.raises(RuntimeError, match=key):
        run(operation())


def test_stt_missing_token(monkeypatch):
    monkeypatch.setenv("CLOUDFLARE_ACCOUNT_ID", "account")
    with pytest.raises(RuntimeError, match="CLOUDFLARE_API_TOKEN"):
        run(stt.transcribe(b"audio", "audio/webm"))


@pytest.mark.parametrize("override", [False, True])
def test_workers_ai_stt_contract(monkeypatch, mock_http, override):
    monkeypatch.setenv("CLOUDFLARE_ACCOUNT_ID", "account")
    monkeypatch.setenv("CLOUDFLARE_API_TOKEN", "cf-token")
    model = "@cf/openai/whisper-large-v3-turbo"
    if override:
        model = "@cf/openai/whisper"
        monkeypatch.setenv("WORKERS_AI_STT_MODEL", model)

    def handle(request):
        assert str(request.url) == (
            f"https://api.cloudflare.com/client/v4/accounts/account/ai/run/{model}"
        )
        assert request.headers["authorization"] == "Bearer cf-token"
        assert json.loads(request.content) == {"audio": base64.b64encode(b"audio bytes").decode()}
        return httpx.Response(200, json={"success": True, "result": {"text": " 안녕하세요 "}})

    mock_http(handle)
    assert run(stt.transcribe(b"audio bytes", "audio/webm")) == "안녕하세요"


@pytest.mark.parametrize(
    "payload",
    [
        {"success": False, "errors": [{"message": "bad audio"}]},
        {"success": True, "result": {}},
        {"success": True, "result": {"text": " "}},
    ],
)
def test_stt_rejects_failed_or_empty_results(monkeypatch, mock_http, payload):
    monkeypatch.setenv("CLOUDFLARE_ACCOUNT_ID", "account")
    monkeypatch.setenv("CLOUDFLARE_API_TOKEN", "token")
    mock_http(lambda request: httpx.Response(200, json=payload))
    with pytest.raises(ValueError):
        run(stt.transcribe(b"audio", "audio/webm"))


@pytest.mark.parametrize("override", [False, True])
def test_tts_contract(monkeypatch, mock_http, override):
    monkeypatch.setenv("CODYSSEY_API_KEY", "test-key")
    if override:
        monkeypatch.setenv("CODYSSEY_TTS_MODEL", "custom-tts")
        monkeypatch.setenv("CODYSSEY_TTS_VOICE", "nova")

    def handle(request):
        assert str(request.url) == "https://copa.codyssey.kr/api/v1/audio/tts"
        assert request.headers["authorization"] == "Bearer test-key"
        assert json.loads(request.content) == {
            "model": "custom-tts" if override else "gpt-4o-mini-tts",
            "input": "안녕하세요",
            "voice": "nova" if override else "alloy",
            "format": "mp3",
            "response_format": "b64_json",
        }
        return httpx.Response(
            200, json={"result": {"b64_json": base64.b64encode(b"mp3 bytes").decode()}}
        )

    mock_http(handle)
    assert run(tts.synthesize("안녕하세요")) == b"mp3 bytes"


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"result": {"b64_json": "!bad!"}},
        {"result": {"b64_json": ""}},
    ],
)
def test_tts_rejects_invalid_audio(monkeypatch, mock_http, payload):
    monkeypatch.setenv("CODYSSEY_API_KEY", "test-key")
    mock_http(lambda request: httpx.Response(200, json=payload))
    with pytest.raises(ValueError):
        run(tts.synthesize("안녕하세요"))


@pytest.mark.parametrize(
    "operation",
    [
        lambda: tts.synthesize("안녕"),
        lambda: stt.transcribe(b"audio", "audio/webm"),
        lambda: planner.generate_board([]),
    ],
)
def test_http_failures_propagate_without_fabrication(monkeypatch, mock_http, operation):
    monkeypatch.setenv("CODYSSEY_API_KEY", "key")
    monkeypatch.setenv("CLOUDFLARE_ACCOUNT_ID", "account")
    monkeypatch.setenv("CLOUDFLARE_API_TOKEN", "token")
    calls = []

    def handle(request):
        calls.append(request)
        return httpx.Response(503, json={"error": "unavailable"})

    mock_http(handle)
    with pytest.raises(httpx.HTTPStatusError):
        run(operation())
    assert len(calls) == 1


def test_json_parser_rejects_non_objects():
    with pytest.raises(ValueError):
        llm.parse_json("[]")


@pytest.fixture(
    params=[
        "잘 모르겠어요. 그냥 좀 쉬고 싶어요.",
        "부모님 돌봄 때문에 이사할 수 없고 주 2시간, 월 3만원만 쓸 수 있어요.",
        "안정적인 수입을 유지하고 싶지만 직장을 그만두고 여행도 하고 싶어요.",
    ],
    ids=["ambiguous", "constraints", "conflicting-wishes"],
)
def quality_history(request):
    return [{"question": "무엇이 중요한가요?", "answer": request.param}]


@pytest.mark.parametrize("question", ["무엇이 중요한가요?", "무엇을 원하나요? 언제 시작하나요?"])
def test_interviewer_repairs_repeated_or_multi_question_turns(
    monkeypatch, mock_http, question, quality_history
):
    monkeypatch.setenv("CODYSSEY_API_KEY", "key")
    calls = []

    def handle(request):
        body = json.loads(request.content)
        calls.append(body)
        assert json.loads(body["messages"][1]["content"])["history"] == quality_history
        assert "쉬운 일상 표현" in body["messages"][0]["content"]
        assert "모호하거나 상충하는 점" in body["messages"][0]["content"]
        return chat_response(
            json.dumps(
                {
                    "question": question
                    if len(calls) == 1
                    else "최근 즐거웠던 일 하나만 들려주실래요?",
                    "done": False,
                }
            )
        )

    mock_http(handle)
    turn = run(interviewer.next_question(quality_history, 10))
    assert turn.question == "최근 즐거웠던 일 하나만 들려주실래요?"
    assert len(calls) == 2


def test_planner_repairs_identical_paths_even_with_different_plan_names(
    monkeypatch, mock_http, quality_history
):
    monkeypatch.setenv("CODYSSEY_API_KEY", "key")
    calls = []

    def handle(request):
        calls.append(request)
        body = json.loads(request.content)
        assert json.loads(body["messages"][1]["content"])["history"] == quality_history
        prompt = body["messages"][0]["content"]
        for policy in (
            "세 플랜 모두",
            "판단할 기준",
            "단계별 조각",
            "가정이라고 표시",
            "서로 다른 우선순위",
        ):
            assert policy in prompt
        data = board_data()
        if len(calls) == 1:
            for plan in data["plans"]:
                plan["pieces"] = deepcopy(data["plans"][0]["pieces"])
        return chat_response(json.dumps(data))

    mock_http(handle)
    assert len(run(planner.generate_board(quality_history)).plans) == 3
    assert len(calls) == 2
