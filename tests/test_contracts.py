import base64
import json

import httpx
import pytest
from pydantic import ValidationError

from odyssey_planner.clients import APIError, Clients
from odyssey_planner.config import Settings
from odyssey_planner.interview import InterviewAgent
from odyssey_planner.planning import PlanningAgent
from odyssey_planner.schemas import Completion, Decision, DraftPlans, InterviewData


def chat_response(content):
    text = content if isinstance(content, str) else json.dumps(content, ensure_ascii=False)
    return httpx.Response(200, json={"choices": [{"message": {"content": text}}]})


def test_audio_api_contracts(tmp_path):
    wav = tmp_path / "input.wav"
    wav.write_bytes(b"RIFF-test-audio")
    mp3 = tmp_path / "output.mp3"
    requests = []

    def handler(request):
        requests.append(request)
        body = json.loads(request.content)
        if "cloudflare.com" in request.url.host:
            assert (
                request.url.path
                == "/client/v4/accounts/account/ai/run/@cf/openai/whisper-large-v3-turbo"
            )
            assert request.headers["Authorization"] == "Bearer cf-token"
            assert body == {
                "audio": base64.b64encode(wav.read_bytes()).decode(),
                "language": "ko",
                "task": "transcribe",
            }
            return httpx.Response(200, json={"success": True, "result": {"text": " 안녕하세요 "}})
        assert str(request.url) == "https://copa.codyssey.kr/api/v1/audio/tts"
        assert request.headers["Authorization"] == "Bearer virtual-key"
        assert body == {
            "model": "tts-1",
            "input": "반갑습니다",
            "voice": "alloy",
            "format": "mp3",
            "response_format": "b64_json",
        }
        return httpx.Response(200, json={"result": {"b64_json": base64.b64encode(b"MP3").decode()}})

    with httpx.Client(transport=httpx.MockTransport(handler)) as http:
        clients = Clients(
            Settings(
                copa_api_key="virtual-key",
                cloudflare_account_id="account",
                cloudflare_api_token="cf-token",
            ),
            http,
        )
        assert clients.transcribe(wav) == "안녕하세요"
        clients.synthesize("반갑습니다", mp3)
    assert mp3.read_bytes() == b"MP3"
    assert len(requests) == 2


def test_structured_retry_rejects_fabricated_evidence(interview, draft):
    invalid = json.loads(json.dumps(draft))
    invalid["plans"][0]["evidence"] = ["imaginary-user"]
    outputs = iter(["not json", invalid, draft])
    calls = []

    def handler(request):
        body = json.loads(request.content)
        calls.append(body)
        assert body["model"] == "claude-opus-4-8"
        assert body["max_tokens"] == 16384
        return chat_response(next(outputs))

    with httpx.Client(transport=httpx.MockTransport(handler)) as http:
        result = PlanningAgent(Clients(Settings(), http)).create(interview)
    assert result.session_id == interview.session_id
    assert len(result.plans) == 3
    assert [len(body["messages"]) for body in calls] == [2, 4, 6]


def test_malformed_json_retries_are_bounded(interview):
    calls = []

    def handler(request):
        calls.append(request)
        return chat_response("bad JSON")

    with httpx.Client(transport=httpx.MockTransport(handler)) as http:
        with pytest.raises(APIError, match="세 번"):
            InterviewAgent(Clients(Settings(), http)).next_turn(interview)
    assert len(calls) == 3


def test_truncated_response_is_not_retried_as_bad_json(interview):
    calls = []

    def handler(request):
        calls.append(request)
        return httpx.Response(
            200,
            json={
                "choices": [{"message": {"content": '{"state":'}, "finish_reason": "length"}],
            },
        )

    with httpx.Client(transport=httpx.MockTransport(handler)) as http:
        with pytest.raises(APIError, match="COPA_MAX_TOKENS"):
            InterviewAgent(Clients(Settings(), http)).next_turn(interview)
    assert len(calls) == 1


def test_http_error_does_not_leak_response_or_key(interview):
    def handler(request):
        return httpx.Response(401, text="secret-response-content")

    with httpx.Client(transport=httpx.MockTransport(handler)) as http:
        with pytest.raises(APIError) as exc:
            PlanningAgent(Clients(Settings(copa_api_key="secret-key"), http)).create(interview)
    assert "401" in str(exc.value)
    assert "secret" not in str(exc.value)


@pytest.mark.parametrize("payload", [{"success": False}, {"result": {}}, {"result": {"text": 123}}])
def test_stt_failure_is_not_an_empty_answer(tmp_path, payload):
    path = tmp_path / "turn.wav"
    path.write_bytes(b"audio")
    with httpx.Client(
        transport=httpx.MockTransport(lambda _: httpx.Response(200, json=payload))
    ) as http:
        with pytest.raises(APIError):
            Clients(Settings(), http).transcribe(path)


def test_tts_invalid_base64_is_not_saved(tmp_path):
    with httpx.Client(
        transport=httpx.MockTransport(
            lambda _: httpx.Response(200, json={"result": {"b64_json": "not-base64!"}})
        )
    ) as http:
        path = tmp_path / "voice.mp3"
        with pytest.raises(APIError):
            Clients(Settings(), http).synthesize("질문", path)
        assert not path.exists()


def test_completion_requires_coverage_and_directions(interview, full_state):
    assert full_state.has_sufficient_context()
    full_state.profile.pop()
    with pytest.raises(ValidationError, match="모든 프로필"):
        Decision(state=full_state, action="complete", reason="충분", speech="마칩니다")
    interview.state = full_state
    interview.completion = Completion(status="sufficient", reason="충분")
    with pytest.raises(ValidationError, match="완료 데이터"):
        InterviewData.model_validate_json(interview.model_dump_json())


def test_interview_rejects_non_user_evidence(interview, full_state):
    full_state.profile[0].evidence = ["assistant-id"]
    with pytest.raises(ValueError, match="사용자 발화 ID"):
        interview.validate_state_evidence(full_state)


def test_draft_requires_three_different_futures_and_five_distinct_years(draft):
    draft["plans"][1]["kind"] = draft["plans"][0]["kind"]
    with pytest.raises(ValidationError, match="세 가지"):
        DraftPlans.model_validate(draft)
    draft["plans"][1]["kind"] = "alternative_path"
    draft["plans"][0]["years"][1]["year"] = 1
    with pytest.raises(ValidationError, match="1~5년"):
        DraftPlans.model_validate(draft)


def test_planning_without_user_data_is_rejected(interview):
    interview.conversation = []
    with httpx.Client() as http:
        with pytest.raises(ValueError, match="발화가 없습니다"):
            PlanningAgent(Clients(Settings(), http)).create(interview)


def test_planning_credentials_do_not_require_cloudflare():
    settings = Settings(copa_api_key="key")
    settings.require_credentials(voice=False)
    with pytest.raises(ValueError, match="CLOUDFLARE"):
        settings.require_credentials(voice=True)
