import React from "react";
import AnalyticsKpiCard from "./AnalyticsKpiCard";

type KpiItem = {
  label: string;
  value: string;
  hint?: string;
};

type Props = {
  items: KpiItem[];
};

export function AnalyticsKpiGrid({ items }: Props) {
  return (
    <div
      style={{
        display: "grid",
        gap: 12,
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
      }}
    >
      {items.map((item) => (
        <AnalyticsKpiCard key={item.label} label={item.label} value={item.value} hint={item.hint} />
      ))}
    </div>
  );
}

export default AnalyticsKpiGrid;
