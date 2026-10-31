import base64
import io
import json
import wave

import httpx2
import pytest
from pydantic import ValidationError

from backend import audio, interview
from backend.api import Settings


def settings(**kwargs):
    return Settings(key="test", account="account", token="token", **kwargs)


def summary():
    return interview.Summary(
        current_situation="직장 생활",
        desired_life_and_interests="글쓰기",
        constraints=[],
        current_path_clues="퇴근 후 글쓰기",
        alternative_path_clues="",
        unconstrained_path_clues="",
        unknowns=["대안과 자유 경로"],
    )


def recording():
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(16000)
        wav.writeframes(b"\0\0" * 100)
    return buffer.getvalue()


def test_voice_api_contracts():
    wav = recording()

    def handler(request):
        body = json.loads(request.content)
        if str(request.url).endswith("/audio/tts"):
            assert body == {
                "model": "tts-1",
                "input": "안녕하세요",
                "voice": "alloy",
                "format": "wav",
                "response_format": "b64_json",
            }
            return httpx2.Response(
                200, json={"result": {"b64_json": base64.b64encode(wav).decode()}}
            )
        assert request.headers["Authorization"] == "Bearer token"
        assert base64.b64decode(body["audio"]) == wav
        assert body["task"] == "transcribe"
        assert body["language"] == "ko"
        return httpx2.Response(200, json={"success": True, "result": {"text": "답변"}})

    with httpx2.Client(transport=httpx2.MockTransport(handler)) as client:
        assert audio.transcribe(client, settings(), wav) == "답변"
        assert audio.synthesize(client, settings(), "안녕하세요") == wav


def test_empty_transcript_is_rejected():
    def handler(request):
        return httpx2.Response(200, json={"success": True, "result": {"text": " "}})

    with httpx2.Client(transport=httpx2.MockTransport(handler)) as client:
        with pytest.raises(ValueError, match="인식된 답변"):
            audio.transcribe(client, settings(), b"audio")


def test_question_limit_reads_env(monkeypatch):
    for name in ["CODYSSEY_API_KEY", "CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"]:
        monkeypatch.setenv(name, "test")
    monkeypatch.setenv("MAX_QUESTIONS", "3")
    assert Settings.from_env().max_questions == 3


def test_fenced_summary_is_validated_without_extra_request():
    requests = []

    def handler(request):
        requests.append(request)
        content = "```json\n" + summary().model_dump_json() + "\n```"
        return httpx2.Response(200, json={"choices": [{"message": {"content": content}}]})

    with httpx2.Client(transport=httpx2.MockTransport(handler)) as client:
        result = interview.ask_model(client, settings(), [], interview.Summary, "요약")
    assert result == summary()
    assert len(requests) == 1


@pytest.mark.parametrize("question,finish", [("", False), ("질문", True)])
def test_question_contract(question, finish):
    with pytest.raises(ValidationError):
        interview.Question(question=question, finish=finish)
