"""Generate a minimal Odyssey plan from a saved interview; run with uv run planner.py."""

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Literal

import httpx2
from dotenv import load_dotenv
from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator

ROOT = Path(__file__).resolve().parent


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class Exchange(StrictModel):
    question: str = Field(min_length=1)
    answer: str = Field(min_length=1)


class Summary(StrictModel):
    current_situation: str
    desired_life_and_interests: str
    constraints: list[str]
    current_path_clues: str
    alternative_path_clues: str
    unconstrained_path_clues: str
    unknowns: list[str]


class Interview(StrictModel):
    exchanges: list[Exchange] = Field(min_length=1)
    summary: Summary


class Year(StrictModel):
    year: int = Field(ge=1, le=5)
    direction: str = Field(min_length=1)


class LifePath(StrictModel):
    kind: Literal["current", "alternative", "unconstrained"]
    title: str = Field(min_length=1)
    summary: str = Field(min_length=1)
    years: list[Year] = Field(min_length=5, max_length=5)
    first_experiment: str = Field(min_length=1)
    assumptions: list[str]

    @model_validator(mode="after")
    def validate_years(self):
        if [item.year for item in self.years] != [1, 2, 3, 4, 5]:
            raise ValueError("years must contain years 1 through 5 in order")
        return self


class Plan(StrictModel):
    paths: list[LifePath] = Field(min_length=3, max_length=3)

    @model_validator(mode="after")
    def validate_kinds(self):
        if {path.kind for path in self.paths} != {"current", "alternative", "unconstrained"}:
            raise ValueError("each of the three path kinds must occur exactly once")
        return self


def save_json(path: Path, data: dict) -> None:
    """Replace atomically so an interrupted write does not destroy a checkpoint."""
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def generate(client: httpx2.Client, interview: Interview) -> Plan:
    key = os.environ.get("CODYSSEY_API_KEY", "").strip()
    if not key:
        raise ValueError(".env에 CODYSSEY_API_KEY를 작성해 주세요.")
    base = os.environ.get("CODYSSEY_BASE_URL", "https://copa.codyssey.kr").rstrip("/")
    prompt = (ROOT / "prompts/planning.md").read_text(encoding="utf-8")
    messages = [
        {"role": "system", "content": prompt},
        {
            "role": "user",
            "content": json.dumps(
                {"interview": interview.model_dump(), "schema": Plan.model_json_schema()},
                ensure_ascii=False,
            ),
        },
    ]
    for attempt in range(2):
        response = client.post(
            f"{base}/v1/chat/completions",
            headers={"Authorization": f"Bearer {key}"},
            json={
                "model": os.environ.get("PLANNING_MODEL", "claude-haiku-4"),
                "messages": messages,
                "max_tokens": 8192,
            },
        )
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        normalized = content.strip()
        lines = normalized.splitlines()
        if len(lines) >= 3 and lines[0] in {"```json", "```"} and lines[-1] == "```":
            normalized = "\n".join(lines[1:-1])
        try:
            return Plan.model_validate_json(normalized)
        except ValidationError as exc:
            if attempt:
                raise ValueError("플랜 JSON 검증에 두 번 실패했습니다.") from exc
            messages.extend(
                [
                    {"role": "assistant", "content": content},
                    {
                        "role": "user",
                        "content": "JSON 검증 오류를 수정하세요: " + exc.json(include_input=False),
                    },
                ]
            )
    raise AssertionError("unreachable")


def main() -> int:
    load_dotenv(ROOT / ".env")
    parser = argparse.ArgumentParser(description="인터뷰 JSON에서 세 가지 5개년 플랜 생성")
    parser.add_argument("interview", type=Path)
    args = parser.parse_args()
    try:
        interview = Interview.model_validate_json(args.interview.read_text(encoding="utf-8"))
        with httpx2.Client(timeout=float(os.environ.get("API_TIMEOUT_SECONDS", "120"))) as client:
            plan = generate(client, interview)
        destination = args.interview.parent / "plan.json"
        save_json(destination, plan.model_dump())
        print(f"플랜 저장: {destination}")
        return 0
    except httpx2.HTTPStatusError as exc:
        print(
            f"API 요청 실패: HTTP {exc.response.status_code}. 인터뷰는 보존됩니다.", file=sys.stderr
        )
    except (httpx2.RequestError, OSError, ValueError, KeyError, IndexError, TypeError):
        print("플랜 생성 실패: 설정·연결·입력 또는 API 응답을 확인하세요.", file=sys.stderr)
    except KeyboardInterrupt:
        print("플랜 생성을 중단했습니다. 인터뷰는 보존됩니다.", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
