import asyncio
import os
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException
from fastapi.encoders import jsonable_encoder
from psycopg.types.json import Jsonb

from models.database import connection
from schemas.api import GeneratedBoard
from services import providers

MAX_AUDIO_BYTES = 25 * 1024 * 1024


def max_questions():
    return max(1, int(os.getenv("INTERVIEW_MAX_QUESTIONS", "10")))


async def provider_call(function, *args):
    try:
        return await function(*args)
    except HTTPException:
        raise
    except Exception as exc:
        if isinstance(exc, RuntimeError) and str(exc).startswith(
            "Missing required environment variable:"
        ):
            raise HTTPException(503, "AI provider is not configured") from exc
        raise HTTPException(502, "AI provider failed; please retry") from exc


def interview_json(row):
    answered = len(row["history"])
    result = {
        "id": str(row["id"]),
        "status": row["status"],
        "question": row["question"],
        "questionNumber": answered + (1 if row["question"] else 0),
        "maxQuestions": row["max_questions"],
        "answeredCount": answered,
    }
    if row["board_id"]:
        result["boardId"] = str(row["board_id"])
    return result


def board_json(row):
    return {
        "id": str(row["id"]),
        "interviewId": str(row["interview_id"]),
        "createdAt": row["created_at"].isoformat(),
        "plans": row["plans"],
    }


async def owned_interview(conn, interview_id, session, lock=False):
    cursor = await conn.execute(
        "SELECT * FROM interviews WHERE id = %s AND session_id = %s"
        + (" FOR UPDATE" if lock else ""),
        (interview_id, session),
    )
    row = await cursor.fetchone()
    if row is None:
        raise HTTPException(404, "Interview not found")
    return row


def turn_question(turn):
    question = turn.question
    if turn.done:
        return None
    if not isinstance(question, str) or not question.strip():
        raise HTTPException(502, "AI provider returned an empty question")
    return question


async def create_interview(session):
    maximum = max_questions()
    turn = await provider_call(providers.next_question, [], maximum)
    question = turn_question(turn)
    async with connection() as conn:
        cursor = await conn.execute(
            """INSERT INTO interviews (id, session_id, status, question, max_questions)
               VALUES (%s, %s, %s, %s, %s) RETURNING *""",
            (uuid4(), session, "ready" if question else "completed", question, maximum),
        )
        return interview_json(await cursor.fetchone())


def save_audio(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


async def submit_answer(conn, row, audio, content_type, number):
    answered = len(row["history"])
    if number is not None and 1 <= number <= answered:
        return interview_json(row)
    if number is not None and number != answered + 1:
        raise HTTPException(409, "Question number is stale or invalid")
    if not row["question"] or row["status"] not in {"ready", "active"}:
        raise HTTPException(409, "Interview is not accepting answers")
    upload_id = uuid4()
    path = Path(os.getenv("AUDIO_STORAGE_PATH", "/app/storage/audio")) / str(row["id"])
    path = path / f"{upload_id}.audio"
    await asyncio.to_thread(save_audio, path, audio)
    # Independent commits retain original audio and successful STT even if the LLM fails.
    async with connection() as uploads:
        await uploads.execute(
            """INSERT INTO audio_uploads
               (id, interview_id, question_number, path, content_type)
               VALUES (%s, %s, %s, %s, %s)""",
            (upload_id, row["id"], answered + 1, str(path), content_type),
        )
    transcript = await provider_call(providers.transcribe, audio, content_type)
    if not isinstance(transcript, str) or not transcript.strip():
        raise HTTPException(502, "No speech was transcribed; please retry")
    async with connection() as uploads:
        await uploads.execute(
            "UPDATE audio_uploads SET transcript = %s WHERE id = %s", (transcript, upload_id)
        )
    history = [*row["history"], {"question": row["question"], "answer": transcript}]
    question = None
    if len(history) < row["max_questions"]:
        turn = await provider_call(providers.next_question, history, row["max_questions"])
        question = turn_question(turn)
    cursor = await conn.execute(
        """UPDATE interviews SET history = %s, question = %s, status = %s
           WHERE id = %s RETURNING *""",
        (Jsonb(history), question, "active" if question else "completed", row["id"]),
    )
    return interview_json(await cursor.fetchone())


async def generate(conn, row, session):
    if row["board_id"]:
        cursor = await conn.execute("SELECT * FROM boards WHERE id = %s", (row["board_id"],))
        return board_json(await cursor.fetchone())
    if row["status"] != "completed":
        raise HTTPException(409, "Complete the interview before generating a board")
    raw = await provider_call(providers.generate_board, row["history"])
    original = getattr(raw, "raw_response", None)
    if hasattr(raw, "model_dump"):
        raw = raw.model_dump(mode="json", by_alias=True)
    try:
        validated = GeneratedBoard.model_validate(raw)
    except ValueError as exc:
        raise HTTPException(502, "AI provider returned an invalid board") from exc
    board_id = uuid4()
    cursor = await conn.execute(
        """INSERT INTO boards (id, interview_id, session_id, raw_plan, plans)
           VALUES (%s, %s, %s, %s, %s) RETURNING *""",
        (
            board_id,
            row["id"],
            session,
            Jsonb(jsonable_encoder(original) if original is not None else raw),
            Jsonb([plan.model_dump() for plan in validated.plans]),
        ),
    )
    board = await cursor.fetchone()
    await conn.execute(
        "UPDATE interviews SET status = 'generated', board_id = %s WHERE id = %s",
        (board_id, row["id"]),
    )
    return board_json(board)
