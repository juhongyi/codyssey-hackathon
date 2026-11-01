import { ArrowRight, Mic, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { PlanCard } from "../components/plan-card";
import { samplePlan } from "../lib/mock-data";

export default function Home() {
  return (
    <>
      <header className="site-header">
        <Link href="/" className="brand" aria-label="오플 홈">
          <span className="brand-star">★</span>
          <span>
            <strong>Ople</strong>
            <small>라이프 디자인 저널</small>
          </span>
        </Link>
        <Link href="/board" className="button small">
          내 보드 ↗
        </Link>
      </header>
      <main className="landing">
        <section className="hero">
          <span className="hero-pill">나를 발견하고, 나다운 미래를 그려요</span>
          <h1>
            일도, 나도 놓치지 않는
            <br />
            <span className="highlight">나만의 다음 장</span>
          </h1>
          <p>
            5~10분 동안 이야기하고, 세 가지 미래에서
            <br />
            마음에 드는 조각을 모아보세요.
          </p>
          <Link href="/interview" className="button primary wide hero-cta">
            <Mic size={20} /> 내 이야기 시작하기{" "}
            <ArrowRight className="push" size={20} />
          </Link>
          <small className="muted">
            마이크가 필요해요 · 로그인 없이 시작할 수 있어요
          </small>
        </section>
        <section className="preview-section">
          <h2 className="preview-sticker">이렇게 완성할 수 있어요</h2>
          <div className="taped">
            <span className="sample-period">2026.10 — 2031.10 · 5년</span>
            <PlanCard plan={samplePlan} createdAt="2026-10-01" sample />
          </div>
          <p className="caption">
            ✳ 예시 보드예요. 당신만의 보드는 이야기를 듣고 만들어요.
          </p>
        </section>
        <section className="steps-section">
          <h2>★ 어떻게 진행되나요?</h2>
          {[
            {
              title: "편하게, 내 이야기 나누기",
              text: "요즘의 고민부터 마음속 작은 바람까지. 질문에 목소리로 답해 주세요.",
            },
            {
              title: "세 가지 다른 미래 만나기",
              text: "지금의 길, 새로운 도전, 또 다른 가능성. 나의 5년을 나란히 살펴봐요.",
            },
            {
              title: "내 손으로 다음 장 다듬기",
              text: "삶의 조각을 더하고 옮기며, 더 나다운 계획으로 완성해요.",
            },
          ].map(({ title, text }, i) => (
            <article className="step" key={title}>
              <span className={`step-number step-${i}`}>0{i + 1}</span>
              <div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            </article>
          ))}
        </section>
        <section className="closing">
          <span>✦</span>
          <h2>
            아직 쓰이지 않은 나의 5년,
            <br />
            어떤 이야기가 될까요?
          </h2>
          <Link className="button primary wide" href="/interview">
            내 이야기 시작하기 <ArrowRight size={20} />
          </Link>
          <p>완벽한 계획보다, 나다운 첫걸음.</p>
        </section>
      </main>
      <footer className="site-footer">
        <p>
          <ShieldCheck size={15} /> 당신의 이야기를 소중하게 다뤄요.
        </p>
        <p>
          대화 기록은 서버 데이터베이스에 저장되며,
          <br />
          원본 음성은 서버 호스트에 보관됩니다.
        </p>
        {/* Authentication is not implemented. */}
        <button className="login-placeholder" type="button" disabled>
          로그인 · 준비 중
        </button>
        <small>© 2026 Ople. Every life, a new chapter.</small>
      </footer>
    </>
  );
}
