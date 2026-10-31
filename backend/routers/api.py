from uuid import UUID

from fastapi import APIRouter, HTTPException, Request, Response
from psycopg.types.json import Jsonb

from models.database import connection
from schemas.api import Plan
from services import providers
from services.interviews import (
    MAX_AUDIO_BYTES,
    board_json,
    create_interview,
    generate,
    interview_json,
    max_questions,
    owned_interview,
    provider_call,
    submit_answer,
)

router = APIRouter(prefix="/api")


@router.get("/config")
async def config():
    return {"maxQuestions": max_questions()}


@router.post("/interviews")
async def create(request: Request):
    return await create_interview(request.state.session_id)


@router.get("/interviews/{interview_id}")
async def get_interview(interview_id: UUID, request: Request):
    async with connection() as conn:
        return interview_json(await owned_interview(conn, interview_id, request.state.session_id))


@router.get("/interviews/{interview_id}/speech")
async def speech(interview_id: UUID, request: Request):
    async with connection() as conn:
        row = await owned_interview(conn, interview_id, request.state.session_id)
    if not row["question"]:
        raise HTTPException(409, "No current question")
    audio = await provider_call(providers.synthesize, row["question"])
    return Response(audio, media_type="audio/mpeg")


@router.post("/interviews/{interview_id}/answers")
async def answers(interview_id: UUID, request: Request):
    async with connection() as conn:
        row = await owned_interview(conn, interview_id, request.state.session_id, lock=True)
        content_type = request.headers.get("content-type", "").split(";", 1)[0].lower().strip()
        if content_type not in {
            "audio/webm",
            "audio/ogg",
            "audio/mp4",
            "audio/mpeg",
            "audio/wav",
            "audio/x-wav",
            "audio/aac",
            "audio/flac",
            "audio/x-m4a",
        }:
            raise HTTPException(415, "Unsupported audio content type")
        audio = bytearray()
        async for chunk in request.stream():
            if len(audio) + len(chunk) > MAX_AUDIO_BYTES:
                raise HTTPException(413, "Audio exceeds 25 MiB")
            audio.extend(chunk)
        if not audio:
            raise HTTPException(400, "Audio body is empty")
        number = request.headers.get("x-question-number")
        try:
            number = int(number) if number is not None else None
        except ValueError as exc:
            raise HTTPException(400, "Invalid question number") from exc
        return await submit_answer(conn, row, bytes(audio), content_type, number)


@router.post("/interviews/{interview_id}/board")
async def create_board(interview_id: UUID, request: Request):
    async with connection() as conn:
        row = await owned_interview(conn, interview_id, request.state.session_id, lock=True)
        return await generate(conn, row, request.state.session_id)


@router.get("/boards/current")
async def current_board(request: Request):
    async with connection() as conn:
        cursor = await conn.execute(
            "SELECT * FROM boards WHERE session_id = %s ORDER BY created_at DESC LIMIT 1",
            (request.state.session_id,),
        )
        row = await cursor.fetchone()
        if row is None:
            raise HTTPException(404, "Board not found")
        return board_json(row)


@router.put("/boards/{board_id}/plans/{plan_id}")
async def update_plan(board_id: UUID, plan_id: str, plan: Plan, request: Request):
    async with connection() as conn:
        cursor = await conn.execute(
            "SELECT * FROM boards WHERE id = %s AND session_id = %s FOR UPDATE",
            (board_id, request.state.session_id),
        )
        row = await cursor.fetchone()
        if row is None:
            raise HTTPException(404, "Board not found")
        if plan.id != plan_id:
            raise HTTPException(400, "Plan id must match the URL")
        if not any(item["id"] == plan_id for item in row["plans"]):
            raise HTTPException(404, "Plan not found")
        plans = [plan.model_dump() if item["id"] == plan_id else item for item in row["plans"]]
        cursor = await conn.execute(
            "UPDATE boards SET plans = %s WHERE id = %s RETURNING *", (Jsonb(plans), board_id)
        )
        return board_json(await cursor.fetchone())
