import React from "react";
import { Card } from "../ui/Ui";
import type { PortfolioScoreTrendV1 } from "../../api/portfolioScoreHistoryApi";

export default function PortfolioScoreMoverList({ movers }: { movers: PortfolioScoreTrendV1["movers"] }) {
  return (
    <Card>
      <div style={{ display: "grid", gap: 12 }}>
        <h3 style={{ margin: 0 }}>Top movers</h3>
        {!movers.length ? (
          <div style={{ color: "#64748b" }}>No material component movement is available yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {movers.map((mover) => (
              <div key={mover.key} style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <strong>{mover.key}</strong>
                  <span>
                    {mover.deltaContribution > 0 ? "+" : ""}
                    {mover.deltaContribution} contribution
                  </span>
                </div>
                <div style={{ color: "#475569", marginTop: 6 }}>{mover.summary}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

