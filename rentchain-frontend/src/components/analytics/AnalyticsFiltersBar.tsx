import React from "react";
import { Card } from "../ui/Ui";
import type { AnalyticsPeriod } from "@/api/landlordAnalyticsApi";

type Props = {
  period: AnalyticsPeriod;
  propertyId: string;
  properties: Array<{ id: string; name: string }>;
  disabled?: boolean;
  onPeriodChange: (period: AnalyticsPeriod) => void;
  onPropertyChange: (propertyId: string) => void;
};

export function AnalyticsFiltersBar({
  period,
  propertyId,
  properties,
  disabled = false,
  onPeriodChange,
  onPropertyChange,
}: Props) {
  return (
    <Card>
      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          alignItems: "end",
        }}
      >
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ color: "#475569", fontSize: "0.88rem", fontWeight: 600 }}>Period</span>
          <select
            aria-label="Analytics period"
            disabled={disabled}
            value={period}
            onChange={(event) => onPeriodChange(event.target.value as AnalyticsPeriod)}
            style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5e1", background: "#fff" }}
          >
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="365d">Last 365 days</option>
            <option value="month_to_date">Month to date</option>
          </select>
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ color: "#475569", fontSize: "0.88rem", fontWeight: 600 }}>Property</span>
          <select
            aria-label="Analytics property"
            disabled={disabled}
            value={propertyId}
            onChange={(event) => onPropertyChange(event.target.value)}
            style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5e1", background: "#fff" }}
          >
            <option value="">All properties</option>
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </select>
        </label>
      </div>
    </Card>
  );
}

export default AnalyticsFiltersBar;
