import React from "react";

const STAGE_STYLES: Record<string, { background: string; color: string }> = {
  fresh: { background: "rgba(16, 185, 129, 0.14)", color: "#047857" },
  aging: { background: "rgba(59, 130, 246, 0.14)", color: "#1d4ed8" },
  due_soon: { background: "rgba(245, 158, 11, 0.16)", color: "#b45309" },
  overdue: { background: "rgba(249, 115, 22, 0.16)", color: "#c2410c" },
  escalated: { background: "rgba(220, 38, 38, 0.16)", color: "#b91c1c" },
};

export default function SlaStageBadge(props: { stage: string }) {
  const style = STAGE_STYLES[props.stage] || STAGE_STYLES.fresh;
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
      SLA {props.stage.replace(/_/g, " ")}
    </span>
  );
}
