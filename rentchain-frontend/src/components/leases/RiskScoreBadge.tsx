import React from "react";
import type { RiskGrade } from "@/types/leaseRisk";

function toneFromGrade(grade: RiskGrade | null | undefined) {
  switch (grade) {
    case "A":
      return { bg: "rgba(220,252,231,0.95)", border: "rgba(34,197,94,0.35)", text: "#166534" };
    case "B":
      return { bg: "rgba(219,234,254,0.96)", border: "rgba(59,130,246,0.35)", text: "#1d4ed8" };
    case "C":
      return { bg: "rgba(254,249,195,0.96)", border: "rgba(234,179,8,0.38)", text: "#a16207" };
    case "D":
    case "E":
      return { bg: "rgba(254,226,226,0.96)", border: "rgba(239,68,68,0.34)", text: "#b91c1c" };
    default:
      return { bg: "rgba(241,245,249,0.96)", border: "rgba(148,163,184,0.35)", text: "#475569" };
  }
}

interface RiskScoreBadgeProps {
  grade?: RiskGrade | null;
  score?: number | null;
  compact?: boolean;
}

export const RiskScoreBadge: React.FC<RiskScoreBadgeProps> = ({ grade, score, compact = false }) => {
  const tone = toneFromGrade(grade);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: compact ? 6 : 8,
        borderRadius: 999,
        padding: compact ? "5px 9px" : "7px 12px",
        background: tone.bg,
        border: `1px solid ${tone.border}`,
        color: tone.text,
        fontWeight: 800,
        fontSize: compact ? 12 : 13,
        lineHeight: 1,
      }}
    >
      <span>{grade || "--"}</span>
      {typeof score === "number" ? <span style={{ color: tone.text }}>{score}</span> : null}
    </span>
  );
};
