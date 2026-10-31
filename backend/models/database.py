import os
from contextlib import asynccontextmanager
from typing import Any

import psycopg
from psycopg.rows import dict_row


@asynccontextmanager
async def connection():
    async with await psycopg.AsyncConnection[dict[str, Any]].connect(
        os.environ["DATABASE_URL"], row_factory=dict_row
    ) as conn:
        yield conn


async def initialize():
    async with connection() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS interviews (
                id UUID PRIMARY KEY, session_id UUID NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                status TEXT NOT NULL, question TEXT, max_questions INTEGER NOT NULL,
                history JSONB NOT NULL DEFAULT '[]', board_id UUID
            );
            CREATE INDEX IF NOT EXISTS interviews_session ON interviews(session_id);
            CREATE TABLE IF NOT EXISTS boards (
                id UUID PRIMARY KEY, interview_id UUID NOT NULL REFERENCES interviews(id),
                session_id UUID NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                raw_plan JSONB NOT NULL, plans JSONB NOT NULL
            );
            CREATE INDEX IF NOT EXISTS boards_session ON boards(session_id, created_at DESC);
            CREATE TABLE IF NOT EXISTS audio_uploads (
                id UUID PRIMARY KEY, interview_id UUID NOT NULL,
                question_number INTEGER NOT NULL, path TEXT NOT NULL,
                content_type TEXT NOT NULL, transcript TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        """)
