const labels: Record<string, string> = {
  resources: "자원",
  resource: "자원",
  liking: "호감",
  interest: "호감",
  confidence: "자신감",
  coherence: "일관성",
  consistency: "일관성",
};
export function Ratings({ scores }: { scores: Record<string, number> }) {
  return (
    <div className="ratings">
      {Object.entries(scores).map(([key, value], index) => (
        <div className="rating" key={key}>
          <div>
            <span>{labels[key] || key}</span>
            <small>
              {value}
              <span className="muted"> / 10</span>
            </small>
          </div>
          <div className="rating-track">
            <i
              style={{
                width: `${Math.max(0, Math.min(100, value * 10))}%`,
                background: ["#D8B54A", "#F2AAA0", "#DDE7D3", "#DBE3EF"][
                  index % 4
                ],
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
