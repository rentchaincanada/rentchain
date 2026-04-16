import React from "react";
import type { PortfolioScoreExternalV1 } from "../../api/landlordPortfolioScoreApi";
import { Card, Pill } from "../ui/Ui";

export default function PortfolioScoreComponentList({
  components,
}: {
  components: PortfolioScoreExternalV1["components"];
}) {
  return (
    <Card style={{ display: "grid", gap: 12 }}>
      <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Score components</h2>
      <div style={{ display: "grid", gap: 10 }}>
        {components.map((component) => (
          <div
            key={component.key}
            style={{
              display: "grid",
              gap: 6,
              padding: 12,
              borderRadius: 12,
              border: "1px solid #e2e8f0",
              background: "#f8fafc",
            }}
          >
            <div style={{ display: "flex", gap: 12, justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 700 }}>{component.label}</div>
              <Pill>{component.status.replace(/_/g, " ")}</Pill>
            </div>
            <div style={{ color: "#475569" }}>{component.summary}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}
