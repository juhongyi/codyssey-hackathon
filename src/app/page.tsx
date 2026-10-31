import { ArrowDown, ShieldCheck, Sparkles, WandSparkles } from "lucide-react";
import { Scores, Timeline } from "../components/timeline";
import { Header, StartLink } from "../components/ui";
import { plannerClient } from "../lib/planner-client";

export default async function Home() {
  const [plan] = await plannerClient.getPlans();
  return (
    <>
      <Header />
      <main className="landing">
        <section className="hero">
          <div className="hero-copy">
            <span className="pill sage tilt">
              <Sparkles size={17} /> 나를 발견하고, 나다운 미래를 그려요
            </span>
            <p className="eyebrow">YOUR LIFE, MORE POSSIBILITIES</p>
            <h1>
              일도, 나도 놓치지 않는
              <br />
              나만의 <span>다음 장</span>
            </h1>
            <p className="hero-description">
              5~10분 동안 이야기하고, 세 가지 미래에서
              <br className="desktop-break" /> 마음에 드는 조각을 모아보세요.
            </p>
            <StartLink />
            <p className="quiet start-note">
              ⓘ 마이크가 필요해요 · 로그인 없이 시작해요
            </p>
            <a className="hero-scroll" href="#how">
              <ArrowDown size={16} /> 어떻게 만들어지나요?
            </a>
          </div>
          <div className="hero-sample">
            <span className="sticker coral">
              <WandSparkles size={18} /> 이렇게 완성할 수 있어요
            </span>
            <article className="paper sample-card">
              <span className="tape" />
              <div className="sample-meta">
                <span className="plan-label work">Plan 1</span>
                <span>5년 타임라인 2026.10 ~ 2031.10</span>
              </div>
              <h2>{plan.title}</h2>
              <div className="dashed-rule" />
              <Timeline plan={plan} />
              <div className="dashed-rule" />
              <Scores plan={plan} />
            </article>
            <span className="sample-caption">
              작은 조각들이 모여, 나다운 삶으로.
            </span>
          </div>
        </section>
        <section id="how" className="how-section">
          <div className="section-heading">
            <p className="eyebrow">A LITTLE CONVERSATION, A BIGGER PICTURE</p>
            <h2>★ 어떻게 진행되나요?</h2>
            <p className="quiet">정답을 찾기보다, 나에게 질문을 건네는 시간.</p>
          </div>
          <div className="steps">
            {[
              {
                title: "나를 발견하기",
                text: "음성으로 가치관과 바람을 이야기해요.",
                color: "mustard",
              },
              {
                title: "세 미래 살펴보기",
                text: "서로 다른 가능성과 현실의 조건을 함께 봐요.",
                color: "sage",
              },
              {
                title: "내 보드 만들기",
                text: "마음에 드는 조각을 모아 나만의 삶을 그려요.",
                color: "blue",
              },
            ].map((step, i) => (
              <article className="paper step" key={step.title}>
                <span className={`step-number ${step.color}`}>0{i + 1}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
        <section className="paper bottom-cta">
          <Sparkles size={24} />
          <h2>오늘, 마음속 생각들을 편안하게 꺼내보세요.</h2>
          <StartLink />
        </section>
      </main>
      <footer className="footer">
        <BrandFooter />
        <p>당신의 미래는, 아직 쓰이지 않은 이야기니까요.</p>
        <span>
          <ShieldCheck size={17} /> 나다운 가능성을 탐색하는 시간
        </span>
      </footer>
    </>
  );
}
function BrandFooter() {
  return <strong>★ ODYSSEY</strong>;
}
