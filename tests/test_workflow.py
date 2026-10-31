import base64
import json
import wave
from datetime import UTC, datetime

import httpx
import numpy as np
import pytest

from odyssey_planner import audio
from odyssey_planner.audio import TurnDetector
from odyssey_planner.cli import run_interview
from odyssey_planner.clients import APIError, Clients
from odyssey_planner.config import Settings
from odyssey_planner.schemas import InterviewData, PlanningData


def test_turn_detector_ignores_short_noise_and_waits_for_silence():
    detector = TurnDetector(Settings(end_silence_seconds=0.3))
    assert not detector.feed(0.3)
    assert not detector.feed(0)
    assert not detector.started
    assert not detector.feed(0.3)
    assert not detector.feed(0.3)
    assert detector.started
    assert not detector.feed(0)
    assert not detector.feed(0.3)  # Pausing silence does not end a turn.
    assert not detector.feed(0)
    assert not detector.feed(0)
    assert detector.feed(0)


def test_continuous_noise_is_bounded():
    detector = TurnDetector(Settings(max_turn_seconds=5))
    assert any(detector.feed(0.2) for _ in range(51))


def test_recording_is_a_decodable_wav_after_keyboard_interrupt(tmp_path, monkeypatch):
    block = np.full(1600, 8000, dtype=np.int16).tobytes()

    class InputStream:
        reads = 0

        def __init__(self, **kwargs):
            assert kwargs["samplerate"] == 16000

        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

        def read(self, frames):
            self.reads += 1
            if self.reads > 3:
                raise KeyboardInterrupt
            return block, False

    monkeypatch.setattr(audio.sd, "RawInputStream", InputStream)
    path = tmp_path / "partial.wav"
    with pytest.raises(KeyboardInterrupt):
        audio.record_turn(path, Settings())
    with wave.open(str(path), "rb") as recording:
        assert recording.getframerate() == 16000
        assert recording.getnchannels() == 1
        assert recording.getsampwidth() == 2
        assert recording.readframes(recording.getnframes()) == block * 3


def test_microphone_failure_is_actionable(tmp_path, monkeypatch):
    def unavailable(**kwargs):
        raise audio.sd.PortAudioError("device unavailable")

    monkeypatch.setattr(audio.sd, "RawInputStream", unavailable)
    with pytest.raises(RuntimeError, match="마이크 접근 권한"):
        audio.record_turn(tmp_path / "failed.wav", Settings())


@pytest.mark.parametrize("ending", ["complete", "user_requested_stop"])
def test_voice_session_to_three_saved_plans(tmp_path, monkeypatch, full_state, draft, ending):
    events = []
    saved_directory = None

    def play(path):
        assert path.read_bytes() == b"mp3"
        events.append("play")

    def record(path, settings):
        nonlocal saved_directory
        saved_directory = path.parent.parent
        assert events[-1] == "play"
        path.write_bytes(b"wav")
        events.append("record")
        now = datetime.now(UTC)
        return now, now

    monkeypatch.setattr(audio, "play", play)
    monkeypatch.setattr(audio, "record_turn", record)
    chat_count = 0

    def handler(request):
        nonlocal chat_count
        body = json.loads(request.content)
        if "cloudflare.com" in request.url.host:
            # Recorded audio and pending utterance must already be persisted before STT.
            saved = InterviewData.model_validate_json(
                (saved_directory / "interview.json").read_text()
            )
            assert saved.conversation[-1].audio_path.endswith("user.wav")
            return httpx.Response(200, json={"result": {"text": "함께 배우고 만드는 일이 좋아요"}})
        if request.url.path.endswith("/tts"):
            return httpx.Response(
                200, json={"result": {"b64_json": base64.b64encode(b"mp3").decode()}}
            )
        chat_count += 1
        if chat_count == 1:
            payload = {
                "state": {
                    "summary": "",
                    "profile": [],
                    "life_context": "",
                    "future_directions": [],
                    "uncertainties": [],
                },
                "action": "ask",
                "reason": "첫 질문",
                "speech": "어떤 순간에 즐거우세요?",
            }
        elif chat_count == 2:
            # The full transcript, not only the latest answer, is handed to the interviewer.
            data = json.loads(body["messages"][1]["content"])
            assert [u["speaker"] for u in data["conversation"]] == ["assistant", "user"]
            payload = {
                "state": full_state.model_dump(mode="json"),
                "action": ending,
                "reason": "충분한 맥락 또는 사용자 요청",
                "speech": "초안을 작성할게요.",
            }
        else:
            payload = draft
        return httpx.Response(
            200, json={"choices": [{"message": {"content": json.dumps(payload)}}]}
        )

    settings = Settings(output_dir=tmp_path)
    with httpx.Client(transport=httpx.MockTransport(handler)) as http:
        path = run_interview(settings, Clients(settings, http))
    plans = PlanningData.model_validate_json(path.read_text())
    interview = InterviewData.model_validate_json(path.with_name("interview.json").read_text())
    assert len(plans.plans) == 3
    assert plans.session_id == interview.session_id
    assert interview.completion.status == ("sufficient" if ending == "complete" else "user_stopped")
    assert events == ["play", "record", "play"]
    assert len(list(path.parent.joinpath("audio").iterdir())) == 3
    assert path.with_name("conversation.json").exists()


def test_stt_error_keeps_recording_and_checkpoint(tmp_path, monkeypatch):
    monkeypatch.setattr(audio, "play", lambda _: None)

    def record(path, settings):
        path.write_bytes(b"saved-recording")
        return datetime.now(UTC), datetime.now(UTC)

    monkeypatch.setattr(audio, "record_turn", record)

    def handler(request):
        if request.url.path.endswith("/tts"):
            return httpx.Response(
                200, json={"result": {"b64_json": base64.b64encode(b"mp3").decode()}}
            )
        if "cloudflare.com" in request.url.host:
            return httpx.Response(503)
        payload = {
            "state": {
                "summary": "",
                "profile": [],
                "life_context": "",
                "future_directions": [],
                "uncertainties": [],
            },
            "action": "ask",
            "reason": "시작",
            "speech": "들려주세요",
        }
        return httpx.Response(
            200, json={"choices": [{"message": {"content": json.dumps(payload)}}]}
        )

    settings = Settings(output_dir=tmp_path)
    with httpx.Client(transport=httpx.MockTransport(handler)) as http:
        with pytest.raises(APIError, match="503"):
            run_interview(settings, Clients(settings, http))
    directory = next(tmp_path.iterdir())
    saved = InterviewData.model_validate_json((directory / "interview.json").read_text())
    assert saved.completion.status == "interrupted"
    assert saved.conversation[-1].status == "failed"
    assert (directory / saved.conversation[-1].audio_path).read_bytes() == b"saved-recording"
    assert not (directory / "plan.json").exists()
