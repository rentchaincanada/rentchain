import React from "react";
import { colors, radius, spacing, text } from "@/styles/tokens";

type Props = {
  completedCount: number;
  totalCount: number;
};

export function ActivationProgressBar({ completedCount, totalCount }: Props) {
  const safeTotal = Math.max(totalCount, 1);
  const percentage = Math.max(0, Math.min(100, (completedCount / safeTotal) * 100));

  return (
    <div style={{ display: "grid", gap: spacing.xs }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: spacing.sm,
          fontSize: "0.9rem",
        }}
      >
        <span style={{ fontWeight: 700, color: text.primary }}>
          {completedCount} of {totalCount} steps complete
        </span>
        <span style={{ color: text.muted }}>{Math.round(percentage)}%</span>
      </div>
      <div
        aria-hidden="true"
        style={{
          height: 10,
          borderRadius: radius.pill,
          background: "#e2e8f0",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${percentage}%`,
            height: "100%",
            borderRadius: radius.pill,
            background: `linear-gradient(90deg, ${colors.accent} 0%, ${colors.navy} 100%)`,
            transition: "width 160ms ease",
          }}
        />
      </div>
    </div>
  );
}
