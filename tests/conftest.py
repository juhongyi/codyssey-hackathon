from datetime import UTC, datetime

import pytest

from odyssey_planner.schemas import (
    Category,
    Direction,
    FutureDirection,
    Insight,
    InterviewData,
    InterviewState,
    Utterance,
)


@pytest.fixture
def interview():
    now = datetime.now(UTC)
    return InterviewData(
        session_id="test-session",
        created_at=now,
        conversation=[
            Utterance(
                id="u2",
                speaker="user",
                text="사람들과 배우고 만드는 일이 즐거워요.",
                started_at=now,
                ended_at=now,
                audio_path="audio/0002-user.wav",
            )
        ],
    )


@pytest.fixture
def full_state():
    return InterviewState(
        summary="배움과 협업을 중시하는 사람",
        profile=[
            Insight(
                category=category,
                description=f"{category.value}에 관한 맥락",
                evidence=["u2"],
                interpretation=True,
                confidence="medium",
            )
            for category in Category
        ],
        life_context="직장 생활을 하면서 새로운 배움을 찾고 있음",
        future_directions=[
            FutureDirection(
                kind=kind,
                description=f"{kind.value} 방향의 단서",
                evidence=["u2"],
            )
            for kind in Direction
        ],
        uncertainties=["구체적인 예산은 미확인"],
    )


@pytest.fixture
def draft():
    return {
        "plans": [
            {
                "kind": kind.value,
                "title": title,
                "summary": "배움과 협업을 중심에 두는 삶의 초안",
                "rationale": "함께 배우고 만드는 경험에서 에너지를 얻음",
                "evidence": ["u2"],
                "years": [
                    {"year": year, "theme": "탐색과 실험", "activities": ["동료와 작은 프로젝트"]}
                    for year in range(1, 6)
                ],
                "resources": ["함께 시도할 동료"],
                "constraints": ["현재 업무 시간"],
                "assumptions": ["주말에 실험 시간을 확보할 수 있다고 가정"],
                "questions": ["어떤 협업 방식이 즐거운가?"],
                "prototypes": [
                    {
                        "experience": "모임 참여",
                        "first_step": "모임 한 곳 찾아보기",
                        "question_to_test": "새로운 사람과의 배움이 즐거운가?",
                    }
                ],
            }
            for kind, title in zip(
                Direction, ["현재 일에서 협업 확대", "배움 공동체 운영", "여행과 창작"], strict=True
            )
        ],
        "open_questions": ["실험에 사용할 수 있는 예산은?"],
    }
