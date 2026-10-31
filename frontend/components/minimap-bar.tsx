import type { Piece } from "../lib/types";

export function MinimapBar({
  pieces,
  start,
  span,
  onNavigate,
}: {
  pieces: Piece[];
  start: number;
  span: number;
  onNavigate: (fraction: number) => void;
}) {
  return (
    <div className="minimap-bar">
      <span>전체 5개년 미니맵</span>
      <div className="minimap-track">
        <div className="minimap-years">
          {[1, 2, 3, 4, 5].map((year) => (
            <i key={year} />
          ))}
        </div>
        {pieces.map((piece) => (
          <i
            className={`minimap-piece ${piece.category}`}
            key={piece.id}
            style={{
              left: `${(piece.startMonth / 60) * 100}%`,
              width: `${(piece.durationMonths / 60) * 100}%`,
              top: `${piece.lane * 6 + 3}px`,
            }}
          />
        ))}
        <span
          className="minimap-window"
          style={{
            left: `${start * 100}%`,
            width: `${Math.min(1, span) * 100}%`,
          }}
        />
        <input
          aria-label="타임라인 위치"
          type="range"
          min={0}
          max={100}
          value={Math.round(start * 100)}
          onChange={(event) => onNavigate(Number(event.target.value) / 100)}
        />
      </div>
    </div>
  );
}
