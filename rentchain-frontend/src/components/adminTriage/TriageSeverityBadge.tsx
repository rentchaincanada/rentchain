import React from "react";

const COLORS: Record<string, { bg: string; fg: string }> = {
  critical: { bg: "#fee2e2", fg: "#b91c1c" },
  high: { bg: "#ffedd5", fg: "#c2410c" },
  medium: { bg: "#fef3c7", fg: "#a16207" },
  low: { bg: "#e0f2fe", fg: "#0369a1" },
};

export function TriageSeverityBadge({ severity }: { severity: string }) {
  const tone = COLORS[severity] || COLORS.low;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: 999,
        background: tone.bg,
        color: tone.fg,
        fontSize: 12,
        fontWeight: 700,
        textTransform: "uppercase",
      }}
    >
      {severity}
    </span>
  );
}

export default TriageSeverityBadge;

