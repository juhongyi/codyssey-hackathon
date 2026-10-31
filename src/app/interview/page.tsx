"use client";
import {
  ArrowRight,
  Check,
  CircleAlert,
  LoaderCircle,
  Mic,
  MicOff,
  RotateCcw,
  Volume2,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Brand, ErrorState, LoadingState } from "../../components/ui";
import { useMicrophone } from "../../components/use-microphone";
import { useResource } from "../../components/use-resource";
import { advanceInterview, initialInterview } from "../../lib/interview";
import { plannerClient } from "../../lib/planner-client";

export default function Interview() {
  const {
    data: questions,
    error,
    retry,
  } = useResource(plannerClient.getQuestions);
  const [state, setState] = useState(initialInterview);
  const mic = useMicrophone();
  const { stop } = mic;
  const question = questions?.[state.index];
  const send = useCallback(
    (event: Parameters<typeof advanceInterview>[1]) =>
      setState((current) =>
        advanceInterview(current, event, questions?.length ?? 5),
      ),
    [questions?.length],
  );
  useEffect(() => {
    if (state.phase !== "speaking" || !question) return;
    let timer: ReturnType<typeof setTimeout>;
    let active = true;
    const done = () => {
      if (active) send("spoken");
    };
    if ("speechSynthesis" in window) {
      const speech = new SpeechSynthesisUtterance(question.title);
      speech.lang = "ko-KR";
      speech.rate = 0.9;
      speech.onend = done;
      speech.onerror = done;
      window.speechSynthesis.speak(speech);
      timer = setTimeout(done, 15000);
    } else timer = setTimeout(done, 1800);
    return () => {
      active = false;
      clearTimeout(timer);
      window.speechSynthesis?.cancel();
    };
  }, [state.phase, question, send]);
  useEffect(() => {
    if (state.phase !== "preparing") return;
    stop();
    const timer = setTimeout(() => send("prepared"), 2300);
    return () => clearTimeout(timer);
  }, [state.phase, send, stop]);

  const ready = state.phase === "ready";
  const preparing = state.phase === "preparing";
  const complete = state.phase === "complete";
  const muted = mic.status === "muted";
  const failed = mic.status === "error";
  const speaking = state.phase === "speaking";
  const hearing = mic.status === "active" && mic.level > 0.055;
  const progress = complete
    ? 100
    : preparing
      ? 90
      : ready
        ? 0
        : Math.round((state.index / (questions?.length ?? 5)) * 85);
  const badge = failed
    ? "마이크 연결 확인"
    : complete
      ? "대화 완료"
      : preparing
        ? "대화 정리 중"
        : ready
          ? "시작 준비"
          : muted
            ? "마이크가 꺼져 있어요"
            : speaking
              ? "질문을 들려드리고 있어요"
              : hearing
                ? "당신의 이야기"
                : "이제 이야기해 주세요";
  const title = failed
    ? "마이크를 사용할 수 없어요"
    : complete
      ? "이야기를 들려주셔서 고마워요"
      : preparing
        ? "이야기를 마무리하고 있어요"
        : ready
          ? "편안하게, 내 이야기부터"
          : question?.title;
  const hint = failed
    ? mic.error
    : complete
      ? "이제 당신의 세 가지 미래를 만나보세요."
      : preparing
        ? "나누어주신 소중한 조각들을 모으고 있어요."
        : ready
          ? "5~10분 동안, 다섯 가지 질문을 나눠요."
          : muted
            ? "마이크를 켜면 이어서 답할 수 있어요."
            : speaking
              ? "일이나 일상의 작은 이야기라도 괜찮아요."
              : question?.hint;
  async function begin() {
    if (await mic.start()) {
      if (ready) send("start");
    }
  }
  return (
    <main className="interview-page">
      <header className="interview-header">
        <Brand />
        <div>
          <span>
            {ready
              ? "인터뷰 준비"
              : complete
                ? "인터뷰 완료"
                : preparing
                  ? "인터뷰 마무리"
                  : `질문 ${state.index + 1} · 총 ${questions?.length ?? 5}개`}
          </span>
          <span>진행률 {progress}%</span>
        </div>
        <div
          className="progress-track"
          role="progressbar"
          aria-label="인터뷰 진행률"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span style={{ width: `${progress}%` }} />
        </div>
      </header>
      {error ? (
        <ErrorState retry={retry} />
      ) : !questions ? (
        <LoadingState />
      ) : (
        <>
          <section className="interview-stage">
            <div
              className={`stone-frame ${speaking && !failed ? "speaking" : ""} ${hearing && !muted && !speaking ? "hearing" : ""}`}
            >
              <Image
                src="/stone.svg"
                width={240}
                height={240}
                alt="고요한 밝은 배경 위의 둥근 돌"
                priority
              />
              {complete && (
                <span className="complete-check">
                  <Check size={22} />
                </span>
              )}
            </div>
            <p className="stone-caption">
              오디세이 {complete ? "라이프 디자인" : "인터뷰"}
            </p>
            <span
              className={`pill status-pill ${failed ? "error-pill" : complete || preparing || hearing ? "sage" : speaking ? "mustard" : ""}`}
            >
              {failed ? (
                <CircleAlert size={14} />
              ) : muted ? (
                <MicOff size={14} />
              ) : speaking ? (
                <span className="status-dot" />
              ) : null}
              {badge}
            </span>
            <div className={failed ? "paper mic-error-card" : "interview-copy"}>
              <h1>{title}</h1>
              <p>{hint}</p>
            </div>
          </section>
          <footer className="interview-controls">
            {preparing ? (
              <div className="preparing-status" role="status">
                <LoaderCircle className="spin" size={19} /> 세 가지 미래의
                윤곽을 그리고 있어요...
              </div>
            ) : complete ? (
              <Link className="interview-action primary" href="/board">
                세 가지 미래 보기 <ArrowRight size={19} />
              </Link>
            ) : failed ? (
              <button
                className="interview-action primary"
                type="button"
                onClick={begin}
              >
                <RotateCcw size={17} /> 다시 시도
              </button>
            ) : (
              <>
                <div
                  className={`audio-status ${hearing && !speaking ? "is-hearing" : ""}`}
                >
                  <span className="mic-circle">
                    {muted ? (
                      <MicOff size={19} />
                    ) : speaking ? (
                      <Volume2 size={19} />
                    ) : (
                      <Mic size={19} />
                    )}
                  </span>
                  <div>
                    <strong>
                      {ready
                        ? "대화 준비 완료"
                        : muted
                          ? "마이크 음소거 상태"
                          : speaking
                            ? "질문이 끝나면 말씀해 주세요"
                            : hearing
                              ? "말씀을 듣고 있어요"
                              : "답변을 기다리고 있어요"}
                    </strong>
                    <small>
                      {ready
                        ? "마이크 사용 권한이 필요해요"
                        : muted
                          ? "음성이 기록되지 않아요"
                          : speaking
                            ? "에이전트가 질문을 읽고 있어요"
                            : "편안한 속도로 이야기해 주세요"}
                    </small>
                  </div>
                  {ready ? (
                    <span className="audio-tag">마이크 대기</span>
                  ) : (
                    <div
                      className={`wave ${speaking ? "playing" : ""}`}
                      role="img"
                      aria-label="마이크 입력 음량"
                    >
                      {[0.5, 0.8, 1, 0.7, 0.45].map((factor, i) => (
                        <span
                          key={factor}
                          style={{
                            height: `${muted ? 3 : 4 + mic.level * 29 * factor}px`,
                            animationDelay: `${i * 100}ms`,
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
                {ready ? (
                  <button
                    className="interview-action primary"
                    type="button"
                    onClick={begin}
                    disabled={mic.status === "requesting"}
                  >
                    <Mic size={18} />
                    {mic.status === "requesting"
                      ? "마이크 연결 중..."
                      : "마이크 켜고 시작하기"}
                  </button>
                ) : (
                  <div className="interview-buttons">
                    <button
                      className="interview-action mute-button"
                      type="button"
                      onClick={mic.toggle}
                    >
                      {muted ? <Mic size={17} /> : <MicOff size={17} />} 마이크{" "}
                      {muted ? "켜기" : "끄기"}
                    </button>
                    <button
                      className="interview-action primary answer-button"
                      type="button"
                      onClick={() => send(speaking ? "spoken" : "answer")}
                      disabled={muted}
                    >
                      {speaking ? "질문 읽기 건너뛰기" : "답변 완료"}
                      <ArrowRight size={17} />
                    </button>
                  </div>
                )}
              </>
            )}
          </footer>
        </>
      )}
    </main>
  );
}
