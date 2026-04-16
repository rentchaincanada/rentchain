import React from "react";
import type { LandlordPortfolioHealthSummaryV1, PortfolioHealthStatus, PortfolioHealthTrend } from "../../api/landlordPortfolioHealthApi";
import { Card, Pill } from "../ui/Ui";

function toneForStatus(status: PortfolioHealthStatus) {
  if (status === "healthy") return { background: "#dcfce7", color: "#166534" };
  if (status === "watch") return { background: "#fef3c7", color: "#92400e" };
  return { background: "#fee2e2", color: "#991b1b" };
}

function labelForTrend(direction: PortfolioHealthTrend) {
  if (direction === "improving") return "Improving";
  if (direction === "declining") return "Declining";
  if (direction === "stable") return "Stable";
  return "Developing";
}

type Props = {
  summary: LandlordPortfolioHealthSummaryV1;
};

export default function PortfolioHealthStatusCard({ summary }: Props) {
  const tone = toneForStatus(summary.overall.status);

  return (
    <Card elevated style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <Pill style={{ background: tone.background, color: tone.color, borderColor: "transparent" }}>
          {summary.overall.status.replace(/_/g, " ")}
        </Pill>
        <Pill>{labelForTrend(summary.trend.direction)}</Pill>
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        <h1 style={{ margin: 0, fontSize: "1.5rem" }}>{summary.overall.headline}</h1>
        <div style={{ color: "#475569", maxWidth: 820 }}>{summary.overall.summary}</div>
        <div style={{ color: "#64748b" }}>{summary.trend.summary}</div>
      </div>
    </Card>
  );
}
