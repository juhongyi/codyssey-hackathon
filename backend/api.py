"""Single-process local voice API; owns all application orchestration and I/O."""

import base64
import json
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path
from threading import Lock
from typing import Annotated
from uuid import UUID, uuid4

import httpx2
from dotenv import load_dotenv
from fastapi import Body, FastAPI, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from backend import audio, interview, planner

logger = logging.getLogger("uvicorn.error")


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


def save_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def create_app(settings: Settings | None = None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app):
        load_dotenv(Path(__file__).resolve().parent.parent / ".env")
        app.state.settings = settings or Settings.from_env()
        yield

    app = FastAPI(lifespan=lifespan)
    # A single worker serializes turns. The local demo intentionally has no job queue.
    turn_lock = Lock()

    @app.post("/api/turns")
    def turn(
        recording: Annotated[bytes, Body(media_type="audio/wav")],
        session_id: Annotated[UUID | None, Query()] = None,
    ):
        config = app.state.settings
        if len(recording) > 10 * 1024 * 1024:
            raise HTTPException(413, "Recording exceeds 10 MiB")
        try:
            audio.validate_recording(recording)
        except ValueError as exc:
            logger.warning("Invalid recording: %s", exc)
            raise HTTPException(400, str(exc)) from exc
        with turn_lock:
            sid = str(session_id or uuid4())
            path = config.output / sid / "interview.json"
            if session_id and not path.exists():
                raise HTTPException(404, "Unknown session")
            data = (
                json.loads(path.read_text(encoding="utf-8"))
                if session_id
                else {
                    "exchanges": [],
                    "summary": None,
                    "question": "사용자의 시작 발화",
                    "status": "active",
                }
            )
            try:
                if data["status"] == "completed":
                    raise HTTPException(409, "Session already completed")
                with httpx2.Client(timeout=config.timeout) as client:
                    logger.info("[%s] STT started", sid)
                    answer = audio.transcribe(client, config, recording)
                    logger.info("[%s] Answer: %s", sid, answer)
                    data["exchanges"].append({"question": data["question"], "answer": answer})
                    save_json(path, data)
                    finish = (
                        data["summary"] is not None
                        or len(data["exchanges"]) >= config.max_questions
                    )
                    if not finish:
                        logger.info("[%s] Generating next interview turn", sid)
                        result = interview.ask_model(
                            client,
                            config,
                            data["exchanges"],
                            interview.Question,
                            "다음 질문 또는 종료",
                        )
                        finish = result.finish
                        if not finish:
                            data["question"] = result.question
                    if finish:
                        if data["summary"] is None:
                            logger.info("[%s] Generating summary", sid)
                            data["summary"] = interview.ask_model(
                                client,
                                config,
                                data["exchanges"],
                                interview.Summary,
                                "인터뷰가 종료되었습니다. 확인된 내용으로 최종 요약을 작성하세요.",
                            ).model_dump()
                            save_json(path, data)
                        plan_path = path.parent / "plan.json"
                        if not plan_path.exists():
                            logger.info("[%s] Generating plan", sid)
                            plan = planner.generate(
                                client,
                                planner.Interview.model_validate(
                                    {
                                        "exchanges": data["exchanges"],
                                        "summary": data["summary"],
                                    }
                                ),
                            )
                            save_json(plan_path, plan.model_dump())
                        data["status"] = "completed"
                        data["question"] = (
                            "인터뷰가 완료되었습니다. 요약과 세 가지 삶의 경로를 저장했습니다."
                        )
                    save_json(path, data)
                    logger.info(
                        "[%s] %s: %s; saved %s", sid, data["status"], data["question"], path
                    )
                    logger.info("[%s] TTS started", sid)
                    speech = audio.synthesize(client, config, data["question"])
                    logger.info("[%s] Audio response ready", sid)
                return {
                    "session_id": sid,
                    "status": data["status"],
                    "audio": base64.b64encode(speech).decode(),
                }
            except HTTPException:
                raise
            except Exception:
                logger.exception("[%s] Voice turn failed; checkpoints preserved at %s", sid, path)
                return JSONResponse(
                    status_code=502,
                    content={
                        "detail": "Voice turn failed; see backend logs",
                        "session_id": sid if path.exists() else None,
                        "status": data["status"],
                    },
                )

    return app


app = create_app()
