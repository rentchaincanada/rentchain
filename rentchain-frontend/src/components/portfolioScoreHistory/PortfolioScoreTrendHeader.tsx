import React from "react";
import { Card, Pill } from "../ui/Ui";
import type { PortfolioScoreTrendV1 } from "../../api/portfolioScoreHistoryApi";

export default function PortfolioScoreTrendHeader({ trend }: { trend: PortfolioScoreTrendV1 }) {
  return (
    <Card>
      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "grid", gap: 4 }}>
            <h2 style={{ margin: 0 }}>Portfolio Score Trend</h2>
            <div style={{ color: "#475569" }}>{trend.summary.headline}</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <Pill tone="accent">{trend.direction}</Pill>
            <Pill tone="neutral">{trend.latest?.grade || "—"}</Pill>
            <div style={{ fontWeight: 700 }}>
              {trend.deltaScore == null ? "No delta yet" : `${trend.deltaScore > 0 ? "+" : ""}${trend.deltaScore}`}
            </div>
          </div>
        </div>
        {trend.deltaGrade ? <div style={{ color: "#475569" }}>Grade change: {trend.deltaGrade}</div> : null}
        {trend.summary.notes.length ? (
          <ul style={{ margin: 0, paddingLeft: 18, color: "#475569" }}>
            {trend.summary.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </Card>
  );
}

