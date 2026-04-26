import React from "react";

const TONES = {
  critical: { background: "rgba(220,38,38,0.14)", color: "#b91c1c" },
  high: { background: "rgba(249,115,22,0.16)", color: "#c2410c" },
  medium: { background: "rgba(245,158,11,0.16)", color: "#92400e" },
  low: { background: "rgba(59,130,246,0.12)", color: "#1d4ed8" },
} as const;

export default function AlertSeverityBadge({ severity }: { severity: keyof typeof TONES }) {
  const tone = TONES[severity];
  return (
    <span style={{ display: "inline-flex", padding: "4px 8px", borderRadius: 999, fontSize: 12, fontWeight: 700, background: tone.background, color: tone.color }}>
      {severity}
    </span>
  );
}
