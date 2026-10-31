import base64
import io
import json
import sys
import wave
from types import SimpleNamespace

import httpx2
import pytest

import interview
import planner


def settings(**kwargs):
    return interview.Settings(key="test", account="account", token="token", **kwargs)


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


def test_max_questions_and_handoff_contract(monkeypatch, tmp_path):
    calls = []

    def model(client, config, exchanges, schema, instruction):
        calls.append(schema)
        if schema is interview.Summary:
            return summary()
        return interview.Question(question="어떤 삶을 원하세요?", finish=False)

    monkeypatch.setattr(interview, "ask_model", model)
    monkeypatch.setattr(interview, "speak", lambda *args: None)
    monkeypatch.setattr(interview, "record", lambda: b"audio")
    monkeypatch.setattr(interview, "transcribe", lambda *args: "글을 쓰고 싶어요.")
    monkeypatch.setattr("builtins.input", lambda _: "")
    path = tmp_path / "interview.json"
    assert interview.run_interview(None, settings(max_questions=2), path)
    result = planner.Interview.model_validate_json(path.read_text())
    assert len(result.exchanges) == 2
    assert calls == [interview.Question, interview.Question, interview.Summary]


def test_confirmed_answer_survives_api_failure(monkeypatch, tmp_path):
    def model(client, config, exchanges, schema, instruction):
        if exchanges:
            raise ValueError("API failure")
        return interview.Question(question="현재 생활은 어떤가요?", finish=False)

    monkeypatch.setattr(interview, "ask_model", model)
    monkeypatch.setattr(interview, "speak", lambda *args: None)
    monkeypatch.setattr(interview, "record", lambda: b"audio")
    monkeypatch.setattr(interview, "transcribe", lambda *args: "일하고 있어요.")
    monkeypatch.setattr("builtins.input", lambda _: "")
    path = tmp_path / "interview.json"
    with pytest.raises(ValueError):
        interview.run_interview(None, settings(), path)
    checkpoint = json.loads(path.read_text())
    assert checkpoint["exchanges"][0]["answer"] == "일하고 있어요."
    assert checkpoint["summary"] is None


def test_early_stop_saves_summary(monkeypatch, tmp_path):
    monkeypatch.setattr(
        interview,
        "ask_model",
        lambda *args: (
            summary()
            if args[3] is interview.Summary
            else interview.Question(question="원하는 삶은?", finish=False)
        ),
    )
    monkeypatch.setattr(interview, "speak", lambda *args: None)
    recordings = iter([b"audio", None])
    monkeypatch.setattr(interview, "record", lambda: next(recordings))
    monkeypatch.setattr(interview, "transcribe", lambda *args: "글쓰기")
    monkeypatch.setattr("builtins.input", lambda _: "")
    path = tmp_path / "interview.json"
    assert interview.run_interview(None, settings(), path)
    assert len(planner.Interview.model_validate_json(path.read_text()).exchanges) == 1


def test_voice_api_contracts(monkeypatch):
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(16000)
        wav.writeframes(b"\0\0" * 10)
    played = []
    monkeypatch.setitem(
        sys.modules,
        "sounddevice",
        SimpleNamespace(
            play=lambda data, rate: played.append((data.shape, rate)),
            wait=lambda: None,
        ),
    )

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
                200,
                json={
                    "result": {
                        "b64_json": base64.b64encode(buffer.getvalue()).decode(),
                    }
                },
            )
        assert request.headers["Authorization"] == "Bearer token"
        assert base64.b64decode(body["audio"]) == b"wav"
        assert body["task"] == "transcribe"
        assert body["language"] == "ko"
        return httpx2.Response(200, json={"success": True, "result": {"text": "답변"}})

    with httpx2.Client(transport=httpx2.MockTransport(handler)) as client:
        assert interview.transcribe(client, settings(), b"wav") == "답변"
        interview.speak(client, settings(), "안녕하세요")
    assert played == [((10, 1), 16000)]


def test_empty_transcript_is_not_saved():
    def handler(request):
        return httpx2.Response(200, json={"success": True, "result": {"text": " "}})

    with httpx2.Client(transport=httpx2.MockTransport(handler)) as client:
        with pytest.raises(ValueError, match="인식된 답변"):
            interview.transcribe(client, settings(), b"audio")


def test_question_limit_reads_env(monkeypatch):
    for name in ["CODYSSEY_API_KEY", "CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"]:
        monkeypatch.setenv(name, "test")
    monkeypatch.setenv("MAX_QUESTIONS", "3")
    assert interview.Settings.from_env().max_questions == 3


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
