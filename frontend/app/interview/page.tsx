"use client";
import {
  ArrowRight,
  LoaderCircle,
  Mic,
  MicOff,
  RotateCcw,
  Volume2,
} from "lucide-react";
import Link from "next/link";
import { Stone } from "../../components/stone";
import { type InterviewPhase, useInterview } from "../../lib/use-interview";

const messages: Record<InterviewPhase, [string, string]> = {
  ready: [
    "편안하게, 내 이야기부터",
    "편안한 목소리로 당신의 이야기를 들려주세요.",
  ],
  speaking: ["당신에게 묻고 있어요", "질문이 끝나면 마이크가 켜져요."],
  listening: [
    "편하게 이야기해 주세요",
    "서두르지 않아도 괜찮아요. 듣고 있어요.",
  ],
  quiet: [
    "천천히, 더 생각해도 괜찮아요",
    "말이 끝난 뒤 약 3초가 지나면 답변을 보내요.",
  ],
  processing: [
    "이야기를 담고 있어요",
    "당신의 말에서 다음 질문을 찾고 있어요.",
  ],
  muted: [
    "잠시 쉬어가도 괜찮아요",
    "방금 녹음은 보내지 않았어요. 준비되면 다시 이야기해 주세요.",
  ],
  error: [
    "잠깐, 연결을 확인해 볼까요?",
    "이야기를 이어갈 수 있도록 다시 시도해 주세요.",
  ],
  replay: [
    "질문을 들을 준비가 되셨나요?",
    "브라우저에서 소리 재생을 허용하려면 아래 버튼을 눌러 주세요.",
  ],
  generating: [
    "이야기를 마무리하고 있어요",
    "나눠주신 이야기를 삶의 조각으로 엮는 중이에요.",
  ],
  completed: [
    "이야기를 들려줘서 고마워요",
    "이제, 당신에게 어울리는 세 가지 미래를 만나볼까요?",
  ],
  generated: [
    "당신의 다음 장이 준비됐어요!",
    "세 가지 가능성 속에서 마음이 움직이는 방향을 찾아봐요.",
  ],
};
const stateLabels: Record<InterviewPhase, string> = {
  ready: "인터뷰 준비",
  speaking: "질문을 들려드리고 있어요",
  listening: "당신의 이야기",
  quiet: "생각을 기다리는 중",
  processing: "다음 질문 준비 중",
  muted: "마이크가 꺼져 있어요",
  error: "연결 확인",
  replay: "질문을 들을 준비",
  generating: "미래를 그리는 중",
  completed: "대화 완료",
  generated: "대화 완료",
};
export default function InterviewPage() {
  const flow = useInterview();
  const { interview, phase, loading } = flow;
  const [fallbackTitle, subtitle] = messages[phase];
  const answeredProgress = interview
    ? Math.min(
        100,
        (interview.answeredCount / Math.max(1, interview.maxQuestions)) * 100,
      )
    : 0;
  const progress =
    phase === "generated"
      ? 100
      : phase === "generating"
        ? 70
        : phase === "completed"
          ? Math.max(70, answeredProgress)
          : answeredProgress;
  const maximum = interview?.maxQuestions ?? flow.maxQuestions;
  const finished = ["completed", "generated", "generating"].includes(phase);
  const title =
    !finished && interview?.question ? interview.question : fallbackTitle;
  const micError = phase === "error" && /마이크|권한/.test(flow.error);
  const stateLabel = micError ? "마이크 연결 확인" : stateLabels[phase];
  const headerStatus = finished
    ? "대화 완료"
    : interview
      ? `질문 ${interview.questionNumber} · 최대 ${interview.maxQuestions}개`
      : "인터뷰 준비";
  const recording = phase === "listening" || phase === "quiet";
  return (
    <main className={`interview-page phase-${phase}`}>
      <header className="interview-header">
        <Link href="/" className="brand" aria-label="오플 홈">
          <span className="brand-star">★</span>
          <span>
            <strong>Ople</strong>
            <small>라이프 디자인 저널</small>
          </span>
        </Link>
      </header>
      <div className="interview-progress">
        <div>
          <span>{headerStatus}</span>
          <span>진행률 {Math.round(progress)}%</span>
        </div>
        <div
          className="progress-track"
          role="progressbar"
          aria-label="인터뷰 진행률"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
        >
          <i style={{ width: `${progress}%` }} />
        </div>
      </div>
      <section className="conversation" aria-live="polite">
        <div className="interview-avatar">
          <div className="voice-orbit orbit-one" />
          <div className="voice-orbit orbit-two" />
          <Stone active={recording || phase === "speaking"} />
        </div>
        <span className="interview-caption">오플 인터뷰</span>
        <div className="voice-state">
          <i />
          {loading ? "인터뷰 준비" : stateLabel}
        </div>
        <h1>{title}</h1>
        <p>
          {phase === "ready"
            ? maximum
              ? `5~10분 동안, 최대 ${maximum}개의 질문을 나눠요.`
              : "질문 수를 확인하고 있어요."
            : subtitle}
        </p>
        {phase === "error" && (
          <div className="error-box" role="alert">
            {flow.error}
          </div>
        )}
      </section>
      <section className="interview-controls">
        <div className="interview-status-strip" role="status">
          <span className="status-mic">
            {phase === "generating" || phase === "processing" ? (
              <LoaderCircle className="status-spinner" size={21} />
            ) : phase === "muted" ? (
              <MicOff size={21} />
            ) : (
              <Mic size={21} />
            )}
          </span>
          <div>
            <strong>
              {phase === "generating"
                ? "세 가지 미래의 윤곽을 그리고 있어요…"
                : stateLabel}
            </strong>
            <small>
              {phase === "ready"
                ? "마이크를 켜면 대화를 시작해요"
                : phase === "generating"
                  ? "잠시만 기다려 주세요"
                  : recording
                    ? "말을 마치면 자동으로 답변을 보내요"
                    : phase === "speaking"
                      ? "질문이 끝나면 마이크가 켜져요"
                      : phase === "muted"
                        ? "녹음은 전송되지 않았어요"
                        : phase === "generated"
                          ? "당신의 라이프 보드가 준비됐어요"
                          : subtitle}
            </small>
          </div>
          <div
            className={`status-wave ${recording || phase === "speaking" ? "is-active" : ""}`}
            aria-hidden="true"
          >
            {[1, 2, 3, 4, 5].map((bar) => (
              <i key={bar} />
            ))}
          </div>
        </div>
        {phase === "ready" && (
          <button
            disabled={loading}
            className="button primary wide"
            type="button"
            onClick={() => void flow.start()}
          >
            <Mic size={19} />
            {interview ? "이야기 이어가기" : "마이크 켜고 시작하기"}
          </button>
        )}
        {(recording || phase === "speaking") && (
          <button className="button wide" type="button" onClick={flow.mute}>
            <MicOff size={19} /> 마이크 끄고 잠시 쉬기
          </button>
        )}
        {phase === "muted" && (
          <>
            <button
              className="button primary wide"
              type="button"
              onClick={flow.resume}
            >
              <Mic size={19} /> 마이크 다시 켜기
            </button>
            <button
              className="text-button"
              type="button"
              onClick={flow.replayQuestion}
            >
              <Volume2 size={16} /> 질문 다시 듣기
            </button>
          </>
        )}
        {phase === "replay" && (
          <button
            className="button primary wide"
            type="button"
            onClick={flow.retry}
          >
            <Volume2 size={19} /> 질문 음성 재생하기
          </button>
        )}
        {phase === "error" && (
          <button
            className="button primary wide"
            type="button"
            onClick={flow.retry}
          >
            <RotateCcw size={19} /> 다시 시도하기
          </button>
        )}
        {phase === "completed" && (
          <button
            className="button primary wide"
            type="button"
            onClick={() => void flow.generate()}
          >
            나의 세 가지 미래 만들기 <ArrowRight size={19} />
          </button>
        )}
        {phase === "generated" && (
          <Link href="/board" className="button primary wide">
            세 가지 미래 보기 <ArrowRight size={19} />
          </Link>
        )}
        {(phase === "processing" || phase === "generating") && (
          <button className="button wide" type="button" disabled>
            조금만 기다려 주세요…
          </button>
        )}
        <p className="privacy-note">
          대화 기록은 서버 DB에, 원본 음성은 서버 호스트에 저장돼요.
        </p>
      </section>
    </main>
  );
}
