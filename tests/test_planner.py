import json

import httpx2
import pytest
from pydantic import ValidationError

import planner


@pytest.fixture
def interview_data():
    return {
        "exchanges": [{"question": "어떤 삶을 원하세요?", "answer": "글 쓰는 시간을 원해요."}],
        "summary": {
            "current_situation": "직장 생활 중",
            "desired_life_and_interests": "글쓰기",
            "constraints": [],
            "current_path_clues": "퇴근 후 글쓰기",
            "alternative_path_clues": "",
            "unconstrained_path_clues": "",
            "unknowns": ["대안 경로", "제약"],
        },
    }


@pytest.fixture
def plan_data():
    return {
        "paths": [
            {
                "kind": kind,
                "title": title,
                "summary": title,
                "years": [{"year": year, "direction": f"{year}년차 탐색"} for year in range(1, 6)],
                "first_experiment": "이번 주 30분 동안 기록하기",
                "assumptions": [],
            }
            for kind, title in [
                ("current", "일과 글쓰기"),
                ("alternative", "다른 일 탐색"),
                ("unconstrained", "창작 중심의 삶"),
            ]
        ]
    }


def test_plan_rejects_duplicate_kinds_and_years(plan_data):
    plan_data["paths"][1]["kind"] = "current"
    with pytest.raises(ValidationError, match="each of the three"):
        planner.Plan.model_validate(plan_data)
    plan_data["paths"][1]["kind"] = "alternative"
    plan_data["paths"][0]["years"][1]["year"] = 1
    with pytest.raises(ValidationError, match="years 1 through 5"):
        planner.Plan.model_validate(plan_data)


def test_generation_repairs_invalid_json(monkeypatch, interview_data, plan_data):
    monkeypatch.setenv("CODYSSEY_API_KEY", "test-key")
    requests = []

    def handler(request):
        requests.append(json.loads(request.content))
        assert str(request.url) == "https://copa.codyssey.kr/v1/chat/completions"
        assert request.headers["Authorization"] == "Bearer test-key"
        content = "invalid" if len(requests) == 1 else "```json\n" + json.dumps(plan_data) + "\n```"
        return httpx2.Response(200, json={"choices": [{"message": {"content": content}}]})

    with httpx2.Client(transport=httpx2.MockTransport(handler)) as client:
        result = planner.generate(client, planner.Interview.model_validate(interview_data))
    assert len(result.paths) == 3
    assert len(requests) == 2
    assert requests[0]["model"] == "claude-haiku-4"
    assert requests[1]["messages"][-1]["role"] == "user"


def test_invalid_generation_preserves_existing_plan(monkeypatch, tmp_path, interview_data):
    monkeypatch.setenv("CODYSSEY_API_KEY", "test-key")
    source = tmp_path / "interview.json"
    planner.save_json(source, interview_data)
    destination = tmp_path / "plan.json"
    destination.write_text("previous validated plan")
    calls = []

    def handler(request):
        calls.append(request)
        return httpx2.Response(200, json={"choices": [{"message": {"content": "{}"}}]})

    real_client = httpx2.Client
    monkeypatch.setattr(
        planner.httpx2,
        "Client",
        lambda **kwargs: real_client(transport=httpx2.MockTransport(handler)),
    )
    monkeypatch.setattr("sys.argv", ["planner.py", str(source)])
    assert planner.main() == 1
    assert len(calls) == 2
    assert destination.read_text() == "previous validated plan"
    assert json.loads(source.read_text()) == interview_data


def test_incomplete_checkpoint_cannot_be_planned(interview_data):
    interview_data["summary"] = None
    with pytest.raises(ValidationError):
        planner.Interview.model_validate(interview_data)
