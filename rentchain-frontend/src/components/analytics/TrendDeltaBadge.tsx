import React from "react";
import type { AnalyticsDeltaValue } from "@/api/landlordAnalyticsApi";

function formatPercent(value: number | null) {
  if (value == null || !Number.isFinite(value)) return null;
  return `${Math.round(value * 100)}%`;
}

function formatSignedNumber(value: number | null, formatter?: (value: number) => string | null) {
  if (value == null || !Number.isFinite(value)) return null;
  const formatted = formatter ? formatter(Math.abs(value)) : String(Math.round(Math.abs(value)));
  if (!formatted) return null;
  return `${value > 0 ? "+" : value < 0 ? "-" : ""}${formatted}`;
}

function tone(direction: AnalyticsDeltaValue["direction"]) {
  if (direction === "better") return { bg: "rgba(16, 185, 129, 0.12)", text: "#047857", label: "Improved" };
  if (direction === "worse") return { bg: "rgba(239, 68, 68, 0.12)", text: "#b91c1c", label: "Worsened" };
  if (direction === "flat") return { bg: "rgba(148, 163, 184, 0.16)", text: "#475569", label: "Flat" };
  return { bg: "rgba(148, 163, 184, 0.14)", text: "#64748b", label: "No comparison yet" };
}

type Props = {
  delta?: AnalyticsDeltaValue | null;
  periodLabel: string;
  formatAbsoluteDelta?: (value: number) => string | null;
};

export function TrendDeltaBadge({ delta, periodLabel, formatAbsoluteDelta }: Props) {
  if (!delta) return null;
  const style = tone(delta.direction);

  let detail = "No prior-period comparison available yet.";
  if (delta.direction !== "insufficient_data") {
    const absolute =
      formatSignedNumber(delta.absoluteDelta, formatAbsoluteDelta) ||
      formatSignedNumber(delta.relativeDelta, (value) => formatPercent(value));
    detail = absolute ? `${absolute} vs prior ${periodLabel}` : `Compared with the prior ${periodLabel}`;
  }

  return (
    <div
      aria-label={`Trend delta: ${style.label}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap",
      }}
    >
      <span
        style={{
          padding: "4px 9px",
          borderRadius: 999,
          background: style.bg,
          color: style.text,
          fontWeight: 700,
          fontSize: "0.78rem",
          textTransform: "uppercase",
        }}
      >
        {style.label}
      </span>
      <span style={{ color: "#64748b", fontSize: "0.86rem" }}>{detail}</span>
    </div>
  );
}

export default TrendDeltaBadge;
