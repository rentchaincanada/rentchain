import React from "react";

const LEVEL_STYLES: Record<string, { background: string; color: string }> = {
  none: { background: "rgba(100, 116, 139, 0.14)", color: "#475569" },
  low: { background: "rgba(59, 130, 246, 0.14)", color: "#1d4ed8" },
  medium: { background: "rgba(245, 158, 11, 0.16)", color: "#b45309" },
  high: { background: "rgba(249, 115, 22, 0.16)", color: "#c2410c" },
  critical: { background: "rgba(220, 38, 38, 0.16)", color: "#b91c1c" },
};

export default function EscalationBadge(props: { level: string }) {
  const style = LEVEL_STYLES[props.level] || LEVEL_STYLES.none;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        background: style.background,
        color: style.color,
      }}
    >
      Escalation {props.level}
    </span>
  );
}
