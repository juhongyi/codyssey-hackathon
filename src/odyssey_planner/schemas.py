from datetime import datetime
from enum import StrEnum
from typing import Literal, Self

from pydantic import BaseModel, ConfigDict, Field, model_validator


class Record(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Category(StrEnum):
    IDENTITY = "identity"
    VALUES = "values_and_motivations"
    STRENGTHS = "strengths_and_patterns"
    ENERGY = "interests_and_energy"
    RELATIONSHIPS = "relationships_and_environment"
    CONTEXT = "life_context_and_constraints"


class Direction(StrEnum):
    CURRENT = "current_path"
    ALTERNATIVE = "alternative_path"
    UNCONSTRAINED = "unconstrained_path"


class Utterance(Record):
    id: str
    speaker: Literal["user", "assistant"]
    text: str
    started_at: datetime
    ended_at: datetime
    # Paths are relative to the session directory.
    audio_path: str | None = None
    status: Literal["pending", "ready", "played", "failed"] = "ready"


class Insight(Record):
    category: Category
    description: str = Field(min_length=1)
    evidence: list[str] = Field(min_length=1)
    interpretation: bool
    confidence: Literal["low", "medium", "high"]


class FutureDirection(Record):
    kind: Direction
    description: str = Field(min_length=1)
    evidence: list[str] = Field(min_length=1)


class InterviewState(Record):
    summary: str
    profile: list[Insight]
    life_context: str
    future_directions: list[FutureDirection]
    uncertainties: list[str]

    def has_sufficient_context(self) -> bool:
        covered = {item.category for item in self.profile if item.confidence != "low"}
        directions = {item.kind for item in self.future_directions}
        return covered == set(Category) and directions == set(Direction)


class Decision(Record):
    state: InterviewState
    action: Literal["ask", "complete", "user_requested_stop"]
    reason: str = Field(min_length=1)
    speech: str = Field(min_length=1)

    @model_validator(mode="after")
    def check_completion(self) -> Self:
        if self.action == "complete" and not self.state.has_sufficient_context():
            raise ValueError("complete에는 모든 프로필 영역과 세 미래 방향의 근거가 필요합니다")
        return self


class Completion(Record):
    status: Literal["in_progress", "sufficient", "user_stopped", "interrupted"] = "in_progress"
    reason: str = ""


class InterviewData(Record):
    schema_version: Literal["1.0"] = "1.0"
    session_id: str
    created_at: datetime
    conversation: list[Utterance] = Field(default_factory=list)
    state: InterviewState = Field(
        default_factory=lambda: InterviewState(
            summary="", profile=[], life_context="", future_directions=[], uncertainties=[]
        )
    )
    completion: Completion = Field(default_factory=Completion)

    def validate_state_evidence(self, state: InterviewState) -> None:
        ids = {item.id for item in self.conversation if item.speaker == "user" and item.text}
        for item in [*state.profile, *state.future_directions]:
            if not set(item.evidence) <= ids:
                raise ValueError("근거는 전사된 사용자 발화 ID만 참조해야 합니다")

    @model_validator(mode="after")
    def check_integrity(self) -> Self:
        ids = [item.id for item in self.conversation]
        if len(ids) != len(set(ids)):
            raise ValueError("발화 ID가 중복되었습니다")
        self.validate_state_evidence(self.state)
        if self.completion.status == "sufficient" and not self.state.has_sufficient_context():
            raise ValueError("충분한 맥락이 없는 완료 데이터입니다")
        return self


class Milestone(Record):
    year: int = Field(ge=1, le=5)
    theme: str = Field(min_length=1)
    activities: list[str] = Field(min_length=1)


class Prototype(Record):
    experience: str = Field(min_length=1)
    first_step: str = Field(min_length=1)
    question_to_test: str = Field(min_length=1)


class Plan(Record):
    kind: Direction
    title: str = Field(min_length=1)
    summary: str = Field(min_length=1)
    rationale: str = Field(min_length=1)
    evidence: list[str] = Field(min_length=1)
    years: list[Milestone] = Field(min_length=5, max_length=5)
    resources: list[str]
    constraints: list[str]
    assumptions: list[str]
    questions: list[str] = Field(min_length=1)
    prototypes: list[Prototype] = Field(min_length=1)

    @model_validator(mode="after")
    def check_years(self) -> Self:
        if sorted(year.year for year in self.years) != [1, 2, 3, 4, 5]:
            raise ValueError("각 계획은 1~5년 차를 중복 없이 포함해야 합니다")
        return self


class DraftPlans(Record):
    plans: list[Plan] = Field(min_length=3, max_length=3)
    open_questions: list[str]

    @model_validator(mode="after")
    def check_directions(self) -> Self:
        if {plan.kind for plan in self.plans} != set(Direction):
            raise ValueError("서로 다른 세 가지 미래 방향이 필요합니다")
        return self


class PlanningData(DraftPlans):
    schema_version: Literal["1.0"] = "1.0"
    session_id: str
    created_at: datetime
