import React from "react";
import { colors, text, radius } from "../../styles/tokens";

type Tone = "neutral" | "info" | "success" | "danger";

const toneStyles: Record<Tone, { bg: string; border: string; color: string }> = {
  neutral: { bg: "rgba(148,163,184,0.16)", border: "rgba(148,163,184,0.4)", color: text.muted },
  info: { bg: "rgba(37,99,235,0.12)", border: "rgba(37,99,235,0.4)", color: colors.accent },
  success: { bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.4)", color: "#047857" },
  danger: { bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.4)", color: colors.danger },
};

export function ScreeningStatusBadge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: Tone;
}) {
  const style = toneStyles[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        fontSize: 12,
        fontWeight: 700,
        borderRadius: radius.pill,
        background: style.bg,
        border: `1px solid ${style.border}`,
        color: style.color,
        lineHeight: 1.2,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}
