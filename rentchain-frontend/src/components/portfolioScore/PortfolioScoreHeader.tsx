import React from "react";
import { Card, Pill } from "../ui/Ui";
import type { PortfolioScoreV1 } from "../../api/portfolioScoreApi";

function statusTone(status: PortfolioScoreV1["summary"]["status"]) {
  if (status === "healthy") return "success";
  if (status === "watch") return "warning";
  return "danger";
}

export default function PortfolioScoreHeader({ portfolioScore }: { portfolioScore: PortfolioScoreV1 }) {
  return (
    <Card>
      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "grid", gap: 4 }}>
            <h2 style={{ margin: 0 }}>Portfolio Score™</h2>
            <div style={{ color: "#475569" }}>Internal admin foundation for portfolio-level operational health.</div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <Pill tone="accent">{portfolioScore.grade}</Pill>
            <Pill tone={statusTone(portfolioScore.summary.status) as any}>{portfolioScore.summary.status}</Pill>
            <div style={{ fontSize: "1.75rem", fontWeight: 700 }}>{portfolioScore.score}</div>
          </div>
        </div>
        <div style={{ fontWeight: 600 }}>{portfolioScore.summary.headline}</div>
        {portfolioScore.summary.notes.length ? (
          <ul style={{ margin: 0, paddingLeft: 18, color: "#475569" }}>
            {portfolioScore.summary.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </Card>
  );
}

