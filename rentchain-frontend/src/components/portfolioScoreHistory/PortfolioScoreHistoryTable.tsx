import React from "react";
import { Card } from "../ui/Ui";
import type { PortfolioScoreSnapshotV1 } from "../../api/portfolioScoreHistoryApi";

export default function PortfolioScoreHistoryTable({ history }: { history: PortfolioScoreSnapshotV1[] }) {
  return (
    <Card>
      <div style={{ display: "grid", gap: 12 }}>
        <h3 style={{ margin: 0 }}>Score history</h3>
        {!history.length ? (
          <div style={{ color: "#64748b" }}>No score snapshots have been stored yet.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#64748b" }}>
                  <th style={{ padding: "8px 0" }}>Snapshot</th>
                  <th style={{ padding: "8px 0" }}>Score</th>
                  <th style={{ padding: "8px 0" }}>Grade</th>
                  <th style={{ padding: "8px 0" }}>Status</th>
                  <th style={{ padding: "8px 0" }}>Headline</th>
                </tr>
              </thead>
              <tbody>
                {history.map((snapshot) => (
                  <tr key={snapshot.snapshotAt} style={{ borderTop: "1px solid #e2e8f0" }}>
                    <td style={{ padding: "10px 0" }}>{new Date(snapshot.snapshotAt).toLocaleString()}</td>
                    <td style={{ padding: "10px 0" }}>{snapshot.score}</td>
                    <td style={{ padding: "10px 0" }}>{snapshot.grade}</td>
                    <td style={{ padding: "10px 0" }}>{snapshot.status}</td>
                    <td style={{ padding: "10px 0", color: "#475569" }}>{snapshot.headline}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
}

