"""Provider audio transport; never accesses local audio devices."""

import base64
import io
import wave


def validate_recording(audio: bytes) -> None:
    try:
        with wave.open(io.BytesIO(audio), "rb") as source:
            if (
                source.getnchannels() != 1
                or source.getsampwidth() != 2
                or source.getframerate() != 16000
                or source.getcomptype() != "NONE"
                or source.getnframes() == 0
                or len(source.readframes(source.getnframes())) != source.getnframes() * 2
            ):
                raise ValueError("16kHz mono 16-bit PCM WAV is required")
    except (wave.Error, EOFError) as exc:
        raise ValueError("Invalid WAV recording") from exc


def transcribe(client, settings, audio):
    response = client.post(
        f"https://api.cloudflare.com/client/v4/accounts/{settings.account}/ai/run/{settings.stt}",
        headers={"Authorization": f"Bearer {settings.token}"},
        json={"audio": base64.b64encode(audio).decode(), "task": "transcribe", "language": "ko"},
    )
    response.raise_for_status()
    body = response.json()
    if body.get("success") is not True:
        raise ValueError("Workers AI 음성 인식 요청이 실패했습니다.")
    text = body["result"]["text"].strip()
    if not text:
        raise ValueError("인식된 답변이 없습니다.")
    return text


def synthesize(client, settings, text):
    response = client.post(
        f"{settings.base}/api/v1/audio/tts",
        headers={"Authorization": f"Bearer {settings.key}"},
        json={
            "model": settings.tts,
            "input": text,
            "voice": settings.voice,
            "format": "wav",
            "response_format": "b64_json",
        },
    )
    response.raise_for_status()
    audio = base64.b64decode(response.json()["result"]["b64_json"], validate=True)
    with wave.open(io.BytesIO(audio), "rb") as source:
        if source.getsampwidth() != 2 or source.getcomptype() != "NONE":
            raise ValueError("TTS는 16비트 PCM WAV 응답이어야 합니다.")
    return audio
