import argparse
import json
import sys
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

import httpx
from pydantic import BaseModel, ValidationError

from .clients import APIError, Clients
from .config import Settings
from .interview import InterviewAgent
from .planning import PlanningAgent
from .schemas import Completion, InterviewData, Utterance


def save(path: Path, data: BaseModel) -> None:
    temporary = path.with_suffix(".tmp")
    temporary.write_text(data.model_dump_json(indent=2), encoding="utf-8")
    temporary.replace(path)


def checkpoint(directory: Path, data: InterviewData) -> None:
    save(directory / "interview.json", data)
    temporary = directory / "conversation.tmp"
    temporary.write_text(
        json.dumps(
            [item.model_dump(mode="json") for item in data.conversation],
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    temporary.replace(directory / "conversation.json")


def run_interview(settings: Settings, clients: Clients) -> Path:
    # Only import microphone support for a voice session, not the planning-only command.
    from .audio import play, record_turn

    session_id = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ") + "-" + uuid4().hex[:8]
    directory = settings.output_dir / session_id
    directory.mkdir(parents=True)
    (directory / "audio").mkdir()
    data = InterviewData(session_id=session_id, created_at=datetime.now(UTC))
    checkpoint(directory, data)
    print(f"세션 저장 위치: {directory.resolve()}", flush=True)
    agent = InterviewAgent(clients)
    try:
        while True:
            print("인터뷰 맥락을 정리하는 중…", flush=True)
            decision = agent.next_turn(data)
            data.state = decision.state
            if decision.action != "ask":
                data.completion = Completion(
                    status="sufficient" if decision.action == "complete" else "user_stopped",
                    reason=decision.reason,
                )
            number = len(data.conversation) + 1
            relative = f"audio/{number:04d}-assistant.mp3"
            utterance = Utterance(
                id=f"a{number}",
                speaker="assistant",
                text=decision.speech,
                started_at=datetime.now(UTC),
                ended_at=datetime.now(UTC),
                audio_path=relative,
                status="pending",
            )
            data.conversation.append(utterance)
            checkpoint(directory, data)
            clients.synthesize(decision.speech, directory / relative)
            utterance.status = "ready"
            checkpoint(directory, data)
            print("에이전트가 말하는 중…", flush=True)
            utterance.started_at = datetime.now(UTC)
            play(directory / relative)
            utterance.ended_at = datetime.now(UTC)
            utterance.status = "played"
            checkpoint(directory, data)
            if decision.action != "ask":
                break
            number = len(data.conversation) + 1
            relative = f"audio/{number:04d}-user.wav"
            utterance = Utterance(
                id=f"u{number}",
                speaker="user",
                text="",
                started_at=datetime.now(UTC),
                ended_at=datetime.now(UTC),
                audio_path=relative,
                status="pending",
            )
            data.conversation.append(utterance)
            checkpoint(directory, data)
            print("듣는 중… (말을 마치고 잠시 쉬면 자동 전송됩니다)", flush=True)
            utterance.started_at, utterance.ended_at = record_turn(directory / relative, settings)
            checkpoint(directory, data)
            print("음성을 전사하는 중…", flush=True)
            utterance.text = clients.transcribe(directory / relative)
            utterance.status = "ready"
            checkpoint(directory, data)
            if not utterance.text:
                raise RuntimeError("발화 내용을 인식하지 못했습니다. 음성은 저장되었습니다")
    except BaseException:
        if data.completion.status == "in_progress":
            data.completion = Completion(status="interrupted", reason="실행 중단 또는 오류")
        if data.conversation and data.conversation[-1].status == "pending":
            data.conversation[-1].status = "failed"
            data.conversation[-1].ended_at = datetime.now(UTC)
        checkpoint(directory, data)
        raise
    print("세 가지 오디세이 플랜을 작성하는 중…", flush=True)
    save(directory / "plan.json", PlanningAgent(clients).create(data))
    return directory / "plan.json"


def main() -> None:
    parser = argparse.ArgumentParser(description="한국어 음성 오디세이 인터뷰·플래너")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("interview", help="음성 인터뷰 후 세 가지 5년 계획 작성")
    plan_parser = commands.add_parser("plan", help="기존 인터뷰 JSON에서 계획 재생성")
    plan_parser.add_argument("interview", type=Path)
    plan_parser.add_argument("--output", type=Path, help="기본: 인터뷰 옆 plan.json")
    args = parser.parse_args()
    try:
        settings = Settings.from_env()
        settings.require_credentials(voice=args.command == "interview")
        with httpx.Client(timeout=httpx.Timeout(180, connect=15)) as http:
            clients = Clients(settings, http)
            if args.command == "interview":
                if sys.platform != "darwin":
                    raise ValueError("음성 인터뷰의 첫 지원 환경은 macOS입니다")
                output = run_interview(settings, clients)
            else:
                data = InterviewData.model_validate_json(args.interview.read_text(encoding="utf-8"))
                output = args.output or args.interview.with_name("plan.json")
                output.parent.mkdir(parents=True, exist_ok=True)
                save(output, PlanningAgent(clients).create(data))
        print(f"플랜 저장 완료: {output.resolve()}")
    except KeyboardInterrupt:
        print("\n중단했습니다. 수집된 데이터는 세션 폴더에 보존됩니다.", file=sys.stderr)
        raise SystemExit(130) from None
    except (APIError, ValueError, ValidationError, OSError, RuntimeError) as exc:
        print(f"오류: {exc}", file=sys.stderr)
        raise SystemExit(1) from None


if __name__ == "__main__":
    main()
