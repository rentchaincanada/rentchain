import React from "react";
import type { LandlordPortfolioHealthSummaryV1 } from "../../api/landlordPortfolioHealthApi";
import { Card } from "../ui/Ui";

type Props = {
  nextFocus: LandlordPortfolioHealthSummaryV1["nextFocus"];
};

export default function PortfolioHealthNextFocusList({ nextFocus }: Props) {
  return (
    <Card style={{ display: "grid", gap: 12 }}>
      <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Next focus</h2>
      <div style={{ display: "grid", gap: 10 }}>
        {nextFocus.map((item) => (
          <div
            key={item.key}
            style={{
              padding: 12,
              borderRadius: 12,
              border: "1px solid #e2e8f0",
              background: "#fff",
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{item.label}</div>
            <div style={{ color: "#475569" }}>{item.summary}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}
