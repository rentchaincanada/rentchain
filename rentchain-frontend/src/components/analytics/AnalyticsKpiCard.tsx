import React from "react";
import { Card } from "../ui/Ui";

type Props = {
  label: string;
  value: string;
  hint?: string;
};

export function AnalyticsKpiCard({ label, value, hint }: Props) {
  return (
    <Card style={{ display: "grid", gap: 6 }}>
      <div style={{ color: "#64748b", fontSize: "0.82rem", fontWeight: 600 }}>{label}</div>
      <div style={{ color: "#0f172a", fontSize: "1.7rem", fontWeight: 700 }}>{value}</div>
      {hint ? <div style={{ color: "#475569", fontSize: "0.92rem" }}>{hint}</div> : null}
    </Card>
  );
}

export default AnalyticsKpiCard;
