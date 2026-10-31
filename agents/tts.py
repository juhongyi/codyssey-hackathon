"""Codyssey text-to-speech returning decoded MP3 bytes."""

import base64
import binascii
import os

import httpx

from .llm import CODYSSEY_ORIGIN, required_env


async def synthesize(text: str) -> bytes:
    key = required_env("CODYSSEY_API_KEY")
    if not text.strip():
        raise ValueError("Speech input must not be empty")
    async with httpx.AsyncClient(timeout=120) as client:
        response = await client.post(
            f"{CODYSSEY_ORIGIN}/api/v1/audio/tts",
            headers={"Authorization": f"Bearer {key}"},
            json={
                "model": os.getenv("CODYSSEY_TTS_MODEL", "gpt-4o-mini-tts"),
                "input": text,
                "voice": os.getenv("CODYSSEY_TTS_VOICE", "alloy"),
                "format": "mp3",
                "response_format": "b64_json",
            },
        )
        response.raise_for_status()
        payload = response.json()
    try:
        encoded = payload["result"]["b64_json"]
        if not isinstance(encoded, str):
            raise ValueError("Expected base64 audio text")
        audio = base64.b64decode(encoded, validate=True)
    except (KeyError, TypeError, ValueError, binascii.Error) as exc:
        raise ValueError("Codyssey TTS returned invalid base64 audio") from exc
    if not audio:
        raise ValueError("Codyssey TTS returned empty audio")
    return audio
