import React from "react";
import type { RiskGrade } from "@/types/leaseRisk";

function toneFromGrade(grade: RiskGrade | null | undefined) {
  switch (grade) {
    case "A":
      return { bg: "rgba(22,163,74,0.12)", border: "rgba(22,163,74,0.3)", text: "#166534" };
    case "B":
      return { bg: "rgba(14,165,233,0.12)", border: "rgba(14,165,233,0.3)", text: "#075985" };
    case "C":
      return { bg: "rgba(245,158,11,0.14)", border: "rgba(245,158,11,0.3)", text: "#92400e" };
    case "D":
    case "E":
      return { bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.3)", text: "#b91c1c" };
    default:
      return { bg: "rgba(148,163,184,0.14)", border: "rgba(148,163,184,0.3)", text: "#475569" };
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
        padding: compact ? "4px 8px" : "6px 12px",
        background: tone.bg,
        border: `1px solid ${tone.border}`,
        color: tone.text,
        fontWeight: 700,
        fontSize: compact ? 12 : 13,
      }}
    >
      <span>{grade || "--"}</span>
      {typeof score === "number" ? <span style={{ opacity: 0.82 }}>{score}</span> : null}
    </span>
  );
};
