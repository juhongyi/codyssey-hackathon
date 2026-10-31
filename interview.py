"""Standalone Korean voice interview script; no project imports."""

import argparse
import base64
import io
import json
import os
import subprocess
import sys
import wave
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

import httpx2
import numpy as np
from dotenv import load_dotenv
from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator

ROOT = Path(__file__).resolve().parent
SAMPLE_RATE = 16000


class Question(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    question: str
    finish: bool

    @model_validator(mode="after")
    def validate_question(self):
        if not self.finish and not self.question:
            raise ValueError("a non-finishing turn needs a question")
        if self.finish and self.question:
            raise ValueError("a finishing turn must have an empty question")
        return self


class Summary(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    current_situation: str
    desired_life_and_interests: str
    constraints: list[str]
    current_path_clues: str
    alternative_path_clues: str
    unconstrained_path_clues: str
    unknowns: list[str]


class Settings(BaseModel):
    key: str = Field(min_length=1)
    account: str = Field(min_length=1)
    token: str = Field(min_length=1)
    base: str = "https://copa.codyssey.kr"
    model: str = "claude-haiku-4"
    tts: str = "tts-1"
    voice: str = "alloy"
    stt: str = "@cf/openai/whisper-large-v3-turbo"
    max_questions: int = Field(default=12, ge=1)
    timeout: float = Field(default=120, gt=0)
    output: Path = Path("outputs")

    @classmethod
    def from_env(cls):
        return cls(
            key=os.environ.get("CODYSSEY_API_KEY", "").strip(),
            account=os.environ.get("CLOUDFLARE_ACCOUNT_ID", "").strip(),
            token=os.environ.get("CLOUDFLARE_API_TOKEN", "").strip(),
            base=os.environ.get("CODYSSEY_BASE_URL", "https://copa.codyssey.kr").rstrip("/"),
            model=os.environ.get("INTERVIEW_MODEL", "claude-haiku-4"),
            tts=os.environ.get("TTS_MODEL", "tts-1"),
            voice=os.environ.get("TTS_VOICE", "alloy"),
            stt=os.environ.get("STT_MODEL", "@cf/openai/whisper-large-v3-turbo"),
            max_questions=os.environ.get("MAX_QUESTIONS", "12"),
            timeout=os.environ.get("API_TIMEOUT_SECONDS", "120"),
            output=os.environ.get("OUTPUT_DIR", "outputs"),
        )


def save_interview(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def ask_model(client, settings, exchanges, schema, instruction):
    messages = [
        {"role": "system", "content": (ROOT / "prompts/interview.md").read_text(encoding="utf-8")},
        {
            "role": "user",
            "content": json.dumps(
                {
                    "exchanges": exchanges,
                    "remaining_questions": settings.max_questions - len(exchanges),
                    "instruction": instruction,
                    "schema": schema.model_json_schema(),
                },
                ensure_ascii=False,
            ),
        },
    ]
    for attempt in range(2):
        response = client.post(
            f"{settings.base}/v1/chat/completions",
            headers={"Authorization": f"Bearer {settings.key}"},
            json={"model": settings.model, "messages": messages, "max_tokens": 4096},
        )
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        normalized = content.strip()
        lines = normalized.splitlines()
        if len(lines) >= 3 and lines[0] in {"```json", "```"} and lines[-1] == "```":
            normalized = "\n".join(lines[1:-1])
        try:
            return schema.model_validate_json(normalized)
        except ValidationError as exc:
            if attempt:
                raise ValueError("인터뷰 JSON 검증에 두 번 실패했습니다.") from exc
            messages.extend(
                [
                    {"role": "assistant", "content": content},
                    {
                        "role": "user",
                        "content": "JSON을 수정하세요: " + exc.json(include_input=False),
                    },
                ]
            )
    raise AssertionError("unreachable")


def record() -> bytes | None:
    import sounddevice as sd

    if input("Enter: 녹음 시작 / q: 인터뷰 종료 > ").strip().lower() == "q":
        return None
    chunks = []

    def capture(data, frames, timing, status):
        if status:
            print(f"녹음 장치 상태: {status}", file=sys.stderr)
        chunks.append(data.copy())

    with sd.InputStream(samplerate=SAMPLE_RATE, channels=1, dtype="int16", callback=capture):
        input("녹음 중입니다. Enter를 누르면 종료합니다. > ")
    if not chunks:
        raise ValueError("녹음된 오디오가 없습니다.")
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(SAMPLE_RATE)
        output.writeframes(np.concatenate(chunks).tobytes())
    return buffer.getvalue()


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


def speak(client, settings, text):
    import sounddevice as sd

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
        samples = np.frombuffer(source.readframes(source.getnframes()), dtype="<i2")
        sd.play(samples.reshape(-1, source.getnchannels()), source.getframerate())
        sd.wait()


def run_interview(client, settings, path):
    data = {"exchanges": [], "summary": None}
    save_interview(path, data)
    while len(data["exchanges"]) < settings.max_questions:
        turn = ask_model(client, settings, data["exchanges"], Question, "다음 질문 또는 종료 제안")
        if turn.finish:
            if data["exchanges"]:
                if input("인터뷰를 마칠까요? Enter: 종료 / c: 계속 > ").strip().lower() != "c":
                    break
            turn = ask_model(
                client,
                settings,
                data["exchanges"],
                Question,
                "사용자가 계속하기를 원합니다. finish=false로 질문 하나를 만드세요.",
            )
            if turn.finish:
                raise ValueError("모델이 질문 대신 종료를 반복했습니다.")
        print(f"\n질문 {len(data['exchanges']) + 1}/{settings.max_questions}: {turn.question}")
        speak(client, settings, turn.question)
        while True:
            audio = record()
            if audio is None:
                break
            try:
                answer = transcribe(client, settings, audio)
                print(f"인식된 답변: {answer}")
                if input("Enter: 답변 확정 / r: 재녹음 > ").strip().lower() == "r":
                    continue
                data["exchanges"].append({"question": turn.question, "answer": answer})
                save_interview(path, data)
                break
            except (httpx2.RequestError, httpx2.HTTPStatusError, ValueError, KeyError, TypeError):
                print("음성 인식 실패. 연결·계정·설정을 확인하세요.", file=sys.stderr)
                if input("Enter: 재녹음 / q: 종료 > ").strip().lower() == "q":
                    audio = None
                    break
        if audio is None:
            break
    if not data["exchanges"]:
        print("답변이 없어 플랜을 생성하지 않습니다.")
        return False
    summary = ask_model(
        client,
        settings,
        data["exchanges"],
        Summary,
        "인터뷰가 종료되었습니다. 확인된 내용으로 최종 요약을 작성하세요.",
    )
    data["summary"] = summary.model_dump()
    save_interview(path, data)
    return True


def main() -> int:
    load_dotenv(ROOT / ".env")
    parser = argparse.ArgumentParser(description="한국어 음성 인터뷰 및 오디세이 플랜 생성")
    parser.parse_args()
    path = None
    try:
        settings = Settings.from_env()
        session = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ") + "-" + uuid4().hex[:8]
        path = settings.output / session / "interview.json"
        print(f"저장 경로: {path}")
        with httpx2.Client(timeout=settings.timeout) as client:
            completed = run_interview(client, settings, path)
        if completed:
            return subprocess.run(
                [sys.executable, str(ROOT / "planner.py"), str(path)], check=False
            ).returncode
        return 0
    except ValidationError:
        print(
            ".env의 인증 키와 숫자 설정을 확인하세요. .env.example을 참고하세요.", file=sys.stderr
        )
    except httpx2.HTTPStatusError as exc:
        print(f"API 요청 실패: HTTP {exc.response.status_code}", file=sys.stderr)
    except (httpx2.RequestError, OSError, ValueError, KeyError, IndexError, TypeError):
        print("인터뷰 실패: 연결·설정·API 응답 또는 오디오 장치를 확인하세요.", file=sys.stderr)
    except (KeyboardInterrupt, EOFError):
        print("인터뷰를 중단했습니다.", file=sys.stderr)
    except Exception as exc:
        # PortAudio exceptions are imported lazily, keeping --help hardware-independent.
        print(f"오디오 처리 실패: {type(exc).__name__}", file=sys.stderr)
    if path and path.exists():
        print(f"확정된 답변은 보존되었습니다: {path}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
