import type { Scores } from "../lib/types";

const dimensions = [
  { key: "resources", label: "자원", color: "#D8B54A" },
  { key: "liking", label: "호감", color: "#F2AAA0" },
  { key: "confidence", label: "자신감", color: "#DDE7D3" },
  { key: "coherence", label: "일관성", color: "#DBE3EF" },
] as const;

export function Ratings({
  scores,
  onChange,
}: {
  scores: Scores;
  onChange?: (scores: Scores) => void;
}) {
  return (
    <div className="ratings">
      {dimensions.map(({ key, label, color }) => {
        const value = scores[key];
        return (
          <div className="rating" key={key}>
            <div>
              <span>{label}</span>
              <small>
                {value === undefined ? (
                  "미평가"
                ) : (
                  <>
                    {value}
                    <span className="muted"> / 10</span>
                  </>
                )}
              </small>
            </div>
            <div className="rating-track">
              <i
                style={{ width: `${(value ?? 0) * 10}%`, background: color }}
              />
            </div>
            {onChange && (
              <>
                <input
                  className="rating-slider"
                  type="range"
                  aria-label={label}
                  min={0}
                  max={10}
                  step={1}
                  value={value ?? 0}
                  disabled={value === undefined}
                  style={{ accentColor: color }}
                  onChange={(event) =>
                    onChange({ ...scores, [key]: Number(event.target.value) })
                  }
                />
                {value === undefined && (
                  <button
                    type="button"
                    className="button small"
                    aria-label={`${label} 평가하기`}
                    onClick={() => onChange({ ...scores, [key]: 0 })}
                  >
                    평가하기
                  </button>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
