import React from "react";

type PlanInterval = "month" | "year";

export function PlanIntervalToggle({
  value,
  onChange,
}: {
  value: PlanInterval;
  onChange: (next: PlanInterval) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <button
        type="button"
        onClick={() => onChange("month")}
        style={{
          padding: "8px 12px",
          borderRadius: 10,
          border:
            value === "month"
              ? "1px solid rgba(37,99,235,0.6)"
              : "1px solid rgba(148,163,184,0.35)",
          background: value === "month" ? "rgba(37,99,235,0.12)" : "transparent",
          color: "#0f172a",
          fontWeight: 800,
          fontSize: 12,
          cursor: "pointer",
        }}
      >
        Monthly
      </button>
      <button
        type="button"
        onClick={() => onChange("year")}
        style={{
          padding: "8px 12px",
          borderRadius: 10,
          border:
            value === "year"
              ? "1px solid rgba(37,99,235,0.6)"
              : "1px solid rgba(148,163,184,0.35)",
          background: value === "year" ? "rgba(37,99,235,0.12)" : "transparent",
          color: "#0f172a",
          fontWeight: 800,
          fontSize: 12,
          cursor: "pointer",
        }}
      >
        Yearly
      </button>
    </div>
  );
}
