from datetime import UTC, datetime
from importlib.resources import files

from .clients import Clients
from .schemas import DraftPlans, InterviewData, PlanningData


class PlanningAgent:
    def __init__(self, clients: Clients):
        self.clients = clients
        self.prompt = files("odyssey_planner").joinpath("prompts/planning.txt").read_text()

    def create(self, data: InterviewData) -> PlanningData:
        ids = {item.id for item in data.conversation if item.speaker == "user" and item.text}
        if not ids:
            raise ValueError("플랜을 작성할 사용자 인터뷰 발화가 없습니다")

        def validate(draft: DraftPlans) -> None:
            for plan in draft.plans:
                if not set(plan.evidence) <= ids:
                    raise ValueError("계획의 근거는 사용자 발화 ID만 참조해야 합니다")

        draft = self.clients.structured(self.prompt, data, DraftPlans, validate)
        return PlanningData(
            **draft.model_dump(), session_id=data.session_id, created_at=datetime.now(UTC)
        )
