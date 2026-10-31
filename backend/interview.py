"""Reusable text-in, structured-result-out interview engine."""

import json
from pathlib import Path

from pydantic import BaseModel, ConfigDict, ValidationError, model_validator

from backend.planner import Summary as Summary

ROOT = Path(__file__).resolve().parent


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


def ask_model(client, settings, exchanges, schema, instruction):
    messages = [
        {"role": "system", "content": (ROOT / "prompts/interview.md").read_text(encoding="utf-8")},
        {
            "role": "user",
            "content": json.dumps(
                {
                    "exchanges": exchanges,
                    "remaining_questions": max(0, settings.max_questions - len(exchanges)),
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
