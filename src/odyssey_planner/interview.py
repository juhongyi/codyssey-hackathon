from importlib.resources import files

from .clients import Clients
from .schemas import Decision, InterviewData


class InterviewAgent:
    def __init__(self, clients: Clients):
        self.clients = clients
        self.prompt = files("odyssey_planner").joinpath("prompts/interview.txt").read_text()

    def next_turn(self, data: InterviewData) -> Decision:
        def validate(decision: Decision) -> None:
            data.validate_state_evidence(decision.state)
            if decision.action == "user_requested_stop" and not any(
                item.speaker == "user" and item.text for item in data.conversation
            ):
                raise ValueError("사용자 발화 없이 사용자 요청으로 종료할 수 없습니다")

        return self.clients.structured(self.prompt, data, Decision, validate)
