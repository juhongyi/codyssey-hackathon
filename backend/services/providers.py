"""The only backend boundary importing the root-level agent package."""

import importlib

from fastapi import HTTPException


async def invoke(module, function, *args):
    try:
        agent = importlib.import_module(f"agents.{module}")
    except ImportError as exc:
        raise HTTPException(503, "AI provider is not configured") from exc
    return await getattr(agent, function)(*args)


async def transcribe(audio: bytes, content_type: str):
    return await invoke("stt", "transcribe", audio, content_type)


async def synthesize(text: str):
    return await invoke("tts", "synthesize", text)


async def next_question(history: list, max_questions: int):
    return await invoke("interviewer", "next_question", history, max_questions)


async def generate_board(history: list):
    return await invoke("planner", "generate_board", history)
