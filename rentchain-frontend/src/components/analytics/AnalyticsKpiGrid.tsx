import React from "react";
import AnalyticsKpiCard from "./AnalyticsKpiCard";
import type { AnalyticsDeltaValue } from "@/api/landlordAnalyticsApi";

type KpiItem = {
  label: string;
  value: string;
  hint?: string;
  delta?: AnalyticsDeltaValue | null;
  formatAbsoluteDelta?: (value: number) => string | null;
};

type Props = {
  items: KpiItem[];
  periodLabel?: string;
};

export function AnalyticsKpiGrid({ items, periodLabel = "period" }: Props) {
  return (
    <div
      data-testid="analytics-kpi-grid"
      style={{
        display: "grid",
        gap: 12,
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
      }}
    >
      {items.map((item) => (
        <AnalyticsKpiCard
          key={item.label}
          label={item.label}
          value={item.value}
          hint={item.hint}
          delta={item.delta}
          periodLabel={periodLabel}
          formatAbsoluteDelta={item.formatAbsoluteDelta}
        />
      ))}
    </div>
  );
}

export default AnalyticsKpiGrid;
