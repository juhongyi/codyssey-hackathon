"""Small Codyssey chat client with validated JSON output and one repair attempt."""

import json
import os
import re

import httpx
from pydantic import BaseModel

CODYSSEY_ORIGIN = "https://copa.codyssey.kr"


def required_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def parse_json(content: str) -> dict:
    text = content.strip()
    fence = re.fullmatch(r"```(?:json)?\s*\n?(.*?)\s*```", text, flags=re.S | re.I)
    if fence:
        text = fence.group(1)
    value = json.loads(text)
    if not isinstance(value, dict):
        raise ValueError("Expected a JSON object")
    return value


def _message_content(payload: dict) -> str:
    try:
        content = payload["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise ValueError("Chat response is missing choices[0].message.content") from exc
    if not isinstance(content, str):
        raise ValueError("Chat response content must be a JSON string")
    return content


async def structured_completion[Output: BaseModel](
    messages: list[dict[str, str]],
    model: str,
    output_type: type[Output],
    *,
    timeout: float = 60,
) -> Output:
    key = required_env("CODYSSEY_API_KEY")
    conversation = list(messages)
    async with httpx.AsyncClient(timeout=timeout) as client:
        for attempt in range(2):
            response = await client.post(
                f"{CODYSSEY_ORIGIN}/v1/chat/completions",
                headers={"Authorization": f"Bearer {key}"},
                json={"model": model, "messages": conversation},
            )
            response.raise_for_status()
            content = ""
            try:
                content = _message_content(response.json())
                return output_type.model_validate(parse_json(content))
            except ValueError as exc:
                if attempt:
                    raise ValueError(
                        "Model did not return valid structured JSON after retry"
                    ) from exc
                if content:
                    conversation.append({"role": "assistant", "content": content})
                conversation.append(
                    {
                        "role": "user",
                        "content": (
                            "Return only a valid JSON object matching the requested schema. "
                            f"Correct these validation errors: {exc}"
                        ),
                    }
                )
    raise AssertionError("Unreachable")
