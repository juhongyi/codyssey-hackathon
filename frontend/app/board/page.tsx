"use client";
import { CloudCheck, House, Plus, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PlanCard } from "../../components/plan-card";
import { ApiError, api } from "../../lib/api-client";
import type { Board } from "../../lib/types";

export default function BoardPage() {
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState("");
  const [empty, setEmpty] = useState(false);
  const [active, setActive] = useState("A");
  const load = useCallback(async () => {
    setError("");
    setEmpty(false);
    try {
      setBoard(await api.board());
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setEmpty(true);
      else
        setError(e instanceof Error ? e.message : "보드를 불러오지 못했어요.");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <>
      <header className="page-header board-header">
        <Link href="/" className="icon-button" aria-label="홈으로">
          <House size={20} />
        </Link>
        <h1>라이프 보드</h1>
        <Link href="/interview?new=1" className="button small">
          <Plus size={14} /> 재시작
        </Link>
      </header>
      <main className="board-main">
        <div className="board-intro">
          <span className="board-intro-label">세 가지 삶을 한눈에</span>
          {board && (
            <span className="board-saved">
              <CloudCheck size={15} /> 서버에 저장됨
            </span>
          )}
        </div>
        {board && (
          <>
            <nav className="plan-tabs" aria-label="플랜 바로가기">
              {board.plans.map((plan) => (
                <a
                  key={plan.id}
                  href={`#plan-${plan.id}`}
                  onClick={() => setActive(plan.id)}
                  className={active === plan.id ? "active" : ""}
                >
                  Plan {plan.id}
                </a>
              ))}
            </nav>
            <div className="board-plans">
              {board.plans.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  createdAt={board.createdAt}
                />
              ))}
            </div>
          </>
        )}
        {!board && !error && !empty && (
          <div className="center-state" role="status">
            나의 미래를 펼치고 있어요…
          </div>
        )}
        {empty && (
          <div className="empty-card">
            <span>✎</span>
            <h2>첫 번째 이야기를 기다려요</h2>
            <p>
              짧은 음성 대화를 나누면
              <br />
              당신만의 세 가지 미래가 이곳에 펼쳐져요.
            </p>
            <Link href="/interview" className="button primary">
              내 이야기 시작하기 →
            </Link>
          </div>
        )}
        {error && (
          <div className="error-box" role="alert">
            <p>{error}</p>
            <button type="button" className="button" onClick={load}>
              다시 불러오기
            </button>
          </div>
        )}
      </main>
      <footer className="board-footer">
        <ShieldCheck size={17} />
        <p>
          대화 기록은 서버 데이터베이스에 저장되며,
          <br />
          원본 음성은 서버 호스트에 보관됩니다.
        </p>
      </footer>
    </>
  );
}
