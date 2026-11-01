import type { Piece } from "../lib/types";
import { CategoryChip } from "./category-chip";

export function Timeline({
  pieces,
  createdAt,
  variant = "sample",
}: {
  pieces: Piece[];
  createdAt: string;
  variant?: "sample" | "board";
}) {
  const year = new Date(createdAt).getFullYear();
  const month = String(new Date(createdAt).getMonth() + 1).padStart(2, "0");
  if (variant === "board")
    return (
      <section
        className="board-timeline"
        aria-label="5년 오플 타임라인"
        style={{
          height: `${Math.max(300, 182 + Math.max(0, ...pieces.map((piece) => piece.lane)) * 104)}px`,
        }}
      >
        <div className="board-year-guides">
          {[0, 1, 2, 3, 4, 5].map((offset) => (
            <div
              key={offset}
              className={`board-year-guide ${offset === 5 ? "final-year" : ""}`}
              style={{ left: `${(offset / 5) * 100}%` }}
            >
              <span className="board-year-number">
                {offset}
                {offset === 5 ? "★" : ""}
              </span>
              <span className="board-year-date">
                {year + offset}.{month}
              </span>
            </div>
          ))}
        </div>
        <div className="board-timeline-baseline" />
        <div className="board-timeline-tracks">
          {pieces.map((piece) => {
            const interval = `${piece.startMonth}~${piece.startMonth + piece.durationMonths}개월 · ${piece.durationMonths}개월`;
            return (
              <div
                key={piece.id}
                className={`board-timeline-piece ${piece.category}`}
                role="img"
                title={`${piece.title} · ${interval}`}
                aria-label={`${piece.title} · ${interval}`}
                style={{
                  left: `${(piece.startMonth / 60) * 100}%`,
                  width: `${(piece.durationMonths / 60) * 100}%`,
                  top: `${49 + piece.lane * 104}px`,
                }}
              >
                <CategoryChip category={piece.category} />
                <strong>{piece.title}</strong>
                <small>{piece.durationMonths}개월</small>
              </div>
            );
          })}
        </div>
      </section>
    );
  return (
    <section className="timeline-preview" aria-label="5년 타임라인">
      <div className="timeline-years">
        {[1, 2, 3, 4, 5].map((offset) => (
          <span key={offset}>
            {year + offset - 1}
            <small>{offset}년차</small>
          </span>
        ))}
      </div>
      <div className="timeline-baseline" />
      <div className="preview-pieces">
        {pieces.map((piece, i) => (
          <div
            key={piece.id}
            className={`preview-piece ${piece.category}`}
            style={{
              left: `${Math.min(78, (piece.startMonth / 60) * 85)}%`,
              top: `${i % 2 === 0 ? 16 + Math.floor(i / 5) * 14 : 139 + Math.floor(i / 5) * 14}px`,
              width: `${Math.max(20, Math.min(36, (piece.durationMonths / 60) * 100))}%`,
            }}
          >
            <CategoryChip category={piece.category} />
            <strong>{piece.title}</strong>
            <small>
              {Math.floor(piece.startMonth / 12) + 1}년차 ·{" "}
              {piece.durationMonths}개월
            </small>
          </div>
        ))}
      </div>
    </section>
  );
}
