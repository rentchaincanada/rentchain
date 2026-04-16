import React from "react";
import { Card } from "../ui/Ui";
import type { PortfolioScoreComponent } from "../../api/portfolioScoreApi";

export default function PortfolioScoreComponentsTable({
  components,
}: {
  components: PortfolioScoreComponent[];
}) {
  return (
    <Card>
      <div style={{ display: "grid", gap: 12 }}>
        <h3 style={{ margin: 0 }}>Score components</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#64748b" }}>
                <th style={{ padding: "8px 0" }}>Component</th>
                <th style={{ padding: "8px 0" }}>Score</th>
                <th style={{ padding: "8px 0" }}>Weight</th>
                <th style={{ padding: "8px 0" }}>Contribution</th>
                <th style={{ padding: "8px 0" }}>Reasons</th>
              </tr>
            </thead>
            <tbody>
              {components.map((component) => (
                <tr key={component.key} style={{ borderTop: "1px solid #e2e8f0", verticalAlign: "top" }}>
                  <td style={{ padding: "10px 0", fontWeight: 600 }}>{component.label}</td>
                  <td style={{ padding: "10px 0" }}>{component.normalizedScore}</td>
                  <td style={{ padding: "10px 0" }}>{Math.round(component.weight * 100)}%</td>
                  <td style={{ padding: "10px 0" }}>{component.contribution}</td>
                  <td style={{ padding: "10px 0", color: "#475569" }}>
                    {(component.reasons || []).join(" ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}

