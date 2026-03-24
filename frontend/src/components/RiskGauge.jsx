import { useMemo } from "react";

export default function RiskGauge({ value = 0, label }) {
  const pct = Math.max(0, Math.min(100, value));
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (pct / 100) * circumference;

  const meta = useMemo(() => {
    if (pct < 30) return { color: "var(--success)", text: "Low" };
    if (pct <= 70) return { color: "var(--warning)", text: "Moderate" };
    return { color: "var(--danger)", text: "High" };
  }, [pct]);

  return (
    <div className="gauge-card">
      <h3>{label}</h3>
      <div className="gauge-wrap">
        <svg width="140" height="140" viewBox="0 0 140 140">
          <circle className="gauge-track" cx="70" cy="70" r={radius} />
          <circle
            className="gauge-progress"
            cx="70"
            cy="70"
            r={radius}
            style={{ stroke: meta.color, strokeDasharray: circumference, strokeDashoffset }}
          />
        </svg>
        <div className="gauge-center">{pct.toFixed(1)}%</div>
      </div>
      <p style={{ color: meta.color }}>{meta.text}</p>
    </div>
  );
}
