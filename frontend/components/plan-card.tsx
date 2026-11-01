import { ArrowUpRight, Pencil } from "lucide-react";
import Link from "next/link";
import type { Plan } from "../lib/types";
import { Ratings } from "./rating-bar";
import { Timeline } from "./timeline";

export function PlanCard({
  plan,
  createdAt,
  sample = false,
}: {
  plan: Plan;
  createdAt: string;
  sample?: boolean;
}) {
  const index = ["A", "B", "C"].indexOf(plan.id);
  const baseline = new Date(createdAt);
  const month = String(baseline.getMonth() + 1).padStart(2, "0");
  const date = `${baseline.getFullYear()}.${month}`;
  const endDate = `${baseline.getFullYear() + 5}.${month}`;
  return (
    <article
      id={`plan-${plan.id}`}
      className={`plan-card ${sample ? "sample-plan-card" : "board-plan-card"}`}
    >
      <div className="plan-card-heading">
        <span className={`plan-label plan-${plan.id}`}>Plan {index + 1}</span>
        <span className="eyebrow">
          {sample ? "이렇게 그려볼 수 있어요" : `생성 기준 ${date}`}
        </span>
        {sample ? (
          <ArrowUpRight size={18} />
        ) : (
          <Link
            className="button small plan-edit"
            href={`/board/${plan.id}/edit`}
          >
            <Pencil size={14} /> 편집
          </Link>
        )}
      </div>
      <h2>{plan.title}</h2>
      <p>{plan.description}</p>
      {!sample && (
        <div className="board-timeline-heading">
          <span>↗ 5년 오플 타임라인</span>
          <small>
            {date}~{endDate}
          </small>
        </div>
      )}
      <Timeline
        pieces={plan.pieces}
        createdAt={createdAt}
        variant={sample ? "sample" : "board"}
      />
      <Ratings scores={plan.scores} />
    </article>
  );
}
