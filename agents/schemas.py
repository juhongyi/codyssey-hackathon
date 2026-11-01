"""Provider-independent data contracts shared with the backend."""

from copy import deepcopy
from typing import Any, Literal, Self

from pydantic import BaseModel, Field, ModelWrapValidatorHandler, PrivateAttr, model_validator


class InterviewTurn(BaseModel):
    question: str | None
    done: bool

    @model_validator(mode="after")
    def validate_question(self) -> Self:
        if self.question is not None:
            self.question = self.question.strip()
        if self.done and self.question is not None:
            raise ValueError("A completed interview must have question=null")
        if not self.done and not self.question:
            raise ValueError("An ongoing interview needs a non-empty question")
        return self


class Piece(BaseModel):
    id: str
    title: str
    description: str = ""
    category: Literal["work", "creative", "relationship", "rest"]
    startMonth: int = Field(ge=0, le=59)
    durationMonths: int = Field(ge=1, le=60)
    lane: int = Field(default=0, ge=0, le=3)

    @model_validator(mode="after")
    def validate_end(self) -> Self:
        if self.startMonth + self.durationMonths > 60:
            raise ValueError("A piece must end within the 60-month board")
        return self


class Plan(BaseModel):
    id: Literal["A", "B", "C"]
    label: Literal["Plan A", "Plan B", "Plan C"]
    title: str
    description: str
    pieces: list[Piece]

    @model_validator(mode="after")
    def validate_label(self) -> Self:
        if self.label != f"Plan {self.id}":
            raise ValueError("Plan label must match its ID")
        return self


class GeneratedBoard(BaseModel):
    plans: list[Plan] = Field(min_length=3, max_length=3)
    _raw_response: dict[str, Any] | None = PrivateAttr(default=None)

    @model_validator(mode="wrap")
    @classmethod
    def capture_raw_response(cls, data: Any, handler: ModelWrapValidatorHandler[Self]) -> Self:
        raw = deepcopy(data) if isinstance(data, dict) else None
        board = handler(data)
        if raw is not None:
            board._raw_response = raw
        return board

    @property
    def raw_response(self) -> dict[str, Any] | None:
        """A detached copy of the original validation input, before normalization."""
        return deepcopy(self._raw_response)

    @model_validator(mode="after")
    def validate_plans(self) -> Self:
        if {plan.id for plan in self.plans} != {"A", "B", "C"}:
            raise ValueError("A board must contain distinct plans A, B, and C")
        return self
