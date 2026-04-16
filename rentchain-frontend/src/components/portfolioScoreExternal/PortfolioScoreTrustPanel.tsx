import React from "react";
import type { PortfolioScoreExternalV1 } from "../../api/landlordPortfolioScoreApi";
import { Card } from "../ui/Ui";

export default function PortfolioScoreTrustPanel({
  trust,
}: {
  trust: PortfolioScoreExternalV1["trust"];
}) {
  return (
    <Card style={{ display: "grid", gap: 8 }}>
      <h2 style={{ margin: 0, fontSize: "1.1rem" }}>How to read this score</h2>
      <div style={{ color: "#334155" }}>{trust.explanation}</div>
      <div style={{ color: "#64748b" }}>{trust.methodologyNote}</div>
    </Card>
  );
}
