import type { CSSProperties } from "react";
import { categories, type Plan } from "../lib/types";

export function Timeline({ plan }: { plan: Plan }) {
  const year = Number(plan.startDate.slice(0, 4));
  return (
    <section
      className="timeline-preview"
      aria-label={`${plan.label} 5년 타임라인`}
    >
      <div className="timeline-grid">
        {[0, 1, 2, 3, 4, 5].map((n) => (
          <div key={n} className="year-line" style={{ left: `${n * 20}%` }}>
            <strong>{n === 5 ? "5★" : n}</strong>
            <span>
              {year + n}
              <br />
              .10
            </span>
          </div>
        ))}
      </div>
      <div className="timeline-orbit" />
      {plan.pieces.map((piece) => (
        <div
          key={piece.id}
          className={`preview-piece ${piece.category}`}
          style={
            {
              "--piece-x": `${4 + piece.year * 15.7}%`,
              "--piece-y": `${40 + piece.lane * 45}px`,
            } as CSSProperties
          }
        >
          <span className="category-label">{categories[piece.category]}</span>
          <strong>{piece.title}</strong>
          <small>{piece.description}</small>
        </div>
      ))}
      <div className="timeline-axis" />
    </section>
  );
}
export function Scores({ plan }: { plan: Plan }) {
  const labels = {
    resource: "자원",
    interest: "호감",
    confidence: "자신감",
    coherence: "일관성",
  };
  return (
    <div className="scores">
      {Object.entries(plan.scores).map(([key, value]) => (
        <div key={key}>
          <div>
            <span>{labels[key as keyof typeof labels]}</span>
            <small>{value}/100</small>
          </div>
          <meter
            className={`meter-${key}`}
            min={0}
            max={100}
            value={value}
            aria-label={labels[key as keyof typeof labels]}
          />
        </div>
      ))}
    </div>
  );
}
