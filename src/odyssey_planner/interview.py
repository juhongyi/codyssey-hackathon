from importlib.resources import files

from .clients import Clients
from .schemas import Decision, InterviewData


class InterviewAgent:
    def __init__(self, clients: Clients):
        self.clients = clients
        self.prompt = files("odyssey_planner").joinpath("prompts/interview.txt").read_text()

    def next_turn(self, data: InterviewData, *, questions_asked: int = 0) -> Decision:
        def validate(decision: Decision) -> None:
            data.validate_state_evidence(decision.state)
            if decision.action == "user_requested_stop" and not any(
                item.speaker == "user" and item.text for item in data.conversation
            ):
                raise ValueError("사용자 발화 없이 사용자 요청으로 종료할 수 없습니다")

        prompt = (
            f"{self.prompt}\n\n"
            f"질문 상한은 {self.clients.settings.max_questions}개이며, "
            f"이미 전달한 질문은 {questions_asked}개입니다. "
            "남은 질문 안에서 중요한 맥락을 우선 탐색하세요. "
            "상한에 도달해도 마지막 답변을 state에 반영하고 기존 action 판단 기준을 따르세요. "
            "추가 질문이 필요한 경우에도 실행 코드가 질문 대신 종료 안내를 전달합니다."
        )
        return self.clients.structured(prompt, data, Decision, validate)
