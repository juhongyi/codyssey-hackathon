from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class Piece(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    title: str
    description: str
    category: Literal["work", "creative", "relationship", "rest"]
    startMonth: int = Field(ge=0, le=59, strict=True)
    durationMonths: int = Field(ge=1, le=60, strict=True)
    lane: int = Field(ge=0, le=3, strict=True)

    @model_validator(mode="after")
    def valid_end(self):
        if self.startMonth + self.durationMonths > 60:
            raise ValueError("Piece must end within 60 months")
        return self


class Plan(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: Literal["A", "B", "C"]
    label: Literal["Plan A", "Plan B", "Plan C"]
    title: str
    description: str
    pieces: list[Piece]
    scores: dict[str, int]

    @model_validator(mode="after")
    def valid_identity(self):
        if self.label != f"Plan {self.id}":
            raise ValueError("Plan label must match its id")
        if len({piece.id for piece in self.pieces}) != len(self.pieces):
            raise ValueError("Piece ids must be unique")
        return self


class GeneratedBoard(BaseModel):
    plans: list[Plan]

    @model_validator(mode="after")
    def three_plans(self):
        if sorted(plan.id for plan in self.plans) != ["A", "B", "C"]:
            raise ValueError("Board must contain plans A, B and C")
        return self
