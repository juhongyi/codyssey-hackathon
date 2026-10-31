"use client";
import {
  Home,
  Map as MapIcon,
  PencilLine,
  Plus,
  Sparkles,
  Star,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Scores, Timeline } from "../../components/timeline";
import { ErrorState, LoadingState } from "../../components/ui";
import { useResource } from "../../components/use-resource";
import { plannerClient } from "../../lib/planner-client";

export default function Board() {
  const { data: plans, error, retry } = useResource(plannerClient.getPlans);
  const [active, setActive] = useState("a");
  return (
    <>
      <header className="board-header">
        <Link className="icon-button" href="/" aria-label="홈">
          <Home size={23} />
        </Link>
        <h1>라이프 보드</h1>
        <Link className="button restart sage" href="/interview">
          <Plus size={20} /> 재시작
        </Link>
      </header>
      <main className="board-main">
        <div className="board-intro">
          <span className="sticker small coral">세 가지 삶을 한눈에</span>
          <span className="quiet">
            <Sparkles size={15} /> 나다운 가능성의 지도
          </span>
        </div>
        <nav className="plan-tabs" aria-label="플랜 바로가기">
          {["a", "b", "c"].map((id, i) => (
            <a
              key={id}
              className={active === id ? "active" : ""}
              href={`#plan-${id}`}
              onClick={() => setActive(id)}
            >
              {i === 0 ? (
                <PencilLine size={16} />
              ) : i === 1 ? (
                <MapIcon size={16} />
              ) : (
                <Star size={16} />
              )}{" "}
              Plan {id.toUpperCase()}
            </a>
          ))}
        </nav>
        {error ? (
          <ErrorState retry={retry} />
        ) : !plans ? (
          <LoadingState />
        ) : (
          <div className="board-plans">
            {plans.map((plan, i) => (
              <article
                id={`plan-${plan.id}`}
                className="paper plan-card"
                key={plan.id}
              >
                <div className="plan-top">
                  <div>
                    <span
                      className={`plan-label ${i === 0 ? "work" : i === 1 ? "creative" : "relationship"}`}
                    >
                      {plan.label}
                    </span>
                    <span className="quiet plan-date">생성 기준 2026.10</span>
                  </div>
                  <Link className="button" href={`/board/${plan.id}/edit`}>
                    편집 <PencilLine size={15} />
                  </Link>
                </div>
                <h2>{plan.title}</h2>
                <p className="plan-description">
                  <strong>{plan.subtitle}</strong> — {plan.description}
                </p>
                <div className="solid-rule" />
                <div className="timeline-heading">
                  <strong>
                    <span className={`plan-accent accent-${plan.id}`}>〰</span>{" "}
                    5년 오디세이 타임라인
                  </strong>
                  <span>2026.10 ~ 2031.10</span>
                </div>
                <Timeline plan={plan} />
                <Scores plan={plan} />
              </article>
            ))}
          </div>
        )}
        <div className="board-end">
          <span>✦</span>
          <p>
            어떤 미래가 가장 나답게 느껴지나요?
            <br />
            <small>마음에 드는 조각부터 천천히 다듬어 보세요.</small>
          </p>
        </div>
      </main>
    </>
  );
}
