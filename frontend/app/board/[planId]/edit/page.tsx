"use client";
import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { PlanEditor } from "../../../../components/plan-editor";
import { api } from "../../../../lib/api-client";
import type { Board } from "../../../../lib/types";

export default function EditPage({
  params,
}: {
  params: Promise<{ planId: string }>;
}) {
  const { planId } = use(params);
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setError("");
    try {
      setBoard(await api.board());
    } catch (e) {
      setError(e instanceof Error ? e.message : "보드를 불러오지 못했어요.");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const plan = board?.plans.find((item) => item.id === planId);
  if (board && plan)
    return (
      <PlanEditor
        key={`${board.id}-${plan.id}`}
        board={board}
        initialPlan={plan}
      />
    );
  return (
    <main className="center-state">
      <span className="loading-star">✦</span>
      <h1>
        {error
          ? "보드를 불러오지 못했어요"
          : board
            ? "이 플랜을 찾을 수 없어요"
            : "삶의 조각을 펼치고 있어요"}
      </h1>
      {error && (
        <>
          <p role="alert">{error}</p>
          <button type="button" className="button primary" onClick={load}>
            다시 시도하기
          </button>
        </>
      )}
      <Link href="/board" className="button">
        보드로 돌아가기
      </Link>
    </main>
  );
}
