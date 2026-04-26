import React from "react";
import type { PortfolioHealthDimensionV1 } from "../../api/landlordPortfolioHealthApi";
import { Card, Pill } from "../ui/Ui";

type Props = {
  dimensions: PortfolioHealthDimensionV1[];
};

export default function PortfolioHealthDimensionList({ dimensions }: Props) {
  return (
    <Card style={{ display: "grid", gap: 12 }}>
      <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Health dimensions</h2>
      <div style={{ display: "grid", gap: 10 }}>
        {dimensions.map((dimension) => (
          <div
            key={dimension.key}
            style={{
              display: "grid",
              gap: 6,
              padding: 12,
              borderRadius: 12,
              border: "1px solid #e2e8f0",
              background: "#f8fafc",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <div style={{ fontWeight: 700 }}>{dimension.label}</div>
              <Pill>{dimension.status.replace(/_/g, " ")}</Pill>
            </div>
            <div style={{ color: "#475569" }}>{dimension.summary}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}
