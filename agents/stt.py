"""Speech transcription using Cloudflare Workers AI, without provider fallback."""

import base64
import os

import httpx

from .llm import required_env


async def transcribe(audio: bytes, content_type: str) -> str:
    account = required_env("CLOUDFLARE_ACCOUNT_ID")
    token = required_env("CLOUDFLARE_API_TOKEN")
    if not audio:
        raise ValueError("Audio must not be empty")
    # Whisper's JSON input is base64 audio; the upload MIME type is not a model field.
    model = os.getenv("WORKERS_AI_STT_MODEL", "@cf/openai/whisper-large-v3-turbo")
    async with httpx.AsyncClient(timeout=120) as client:
        response = await client.post(
            f"https://api.cloudflare.com/client/v4/accounts/{account}/ai/run/{model}",
            headers={"Authorization": f"Bearer {token}"},
            json={"audio": base64.b64encode(audio).decode("ascii")},
        )
        response.raise_for_status()
        payload = response.json()
    if not isinstance(payload, dict) or payload.get("success") is not True:
        raise ValueError("Workers AI transcription failed")
    result = payload.get("result")
    text = result.get("text") if isinstance(result, dict) else None
    if not isinstance(text, str) or not text.strip():
        raise ValueError("Workers AI returned no transcription text")
    return text.strip()
