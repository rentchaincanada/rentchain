import React from "react";
import type { PortfolioScoreExternalV1 } from "../../api/landlordPortfolioScoreApi";
import { Card, Pill } from "../ui/Ui";

function trendLabel(direction: PortfolioScoreExternalV1["trend"]["direction"]) {
  if (direction === "improving") return "Improving";
  if (direction === "declining") return "Declining";
  if (direction === "stable") return "Stable";
  return "Developing";
}

export default function PortfolioScoreHeader({ portfolioScore }: { portfolioScore: PortfolioScoreExternalV1 }) {
  return (
    <Card elevated style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div
          style={{
            minWidth: 92,
            minHeight: 92,
            borderRadius: 20,
            background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
            color: "#fff",
            display: "grid",
            placeItems: "center",
            padding: 12,
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 800, lineHeight: 1 }}>{portfolioScore.score}</div>
            <div style={{ fontSize: "0.85rem", opacity: 0.9 }}>Grade {portfolioScore.grade}</div>
          </div>
        </div>
        <div style={{ display: "grid", gap: 8, flex: 1, minWidth: 240 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Pill>{`Grade ${portfolioScore.grade}`}</Pill>
            <Pill>{trendLabel(portfolioScore.trend.direction)}</Pill>
          </div>
          <h1 style={{ margin: 0, fontSize: "1.5rem" }}>{portfolioScore.summary.headline}</h1>
          <div style={{ color: "#475569", maxWidth: 820 }}>{portfolioScore.summary.explanation}</div>
          <div style={{ color: "#64748b" }}>{portfolioScore.trend.summary}</div>
        </div>
      </div>
    </Card>
  );
}
