import React from "react";
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { TimeRange } from "./TimeRangeSelector";

export type ApplicationsPoint = {
  period: string;   // e.g. "Week 1", "Nov", etc.
  received: number;
  approved: number;
  declined: number;
};

type DashboardApplicationsChartProps = {
  selectedPropertyId?: string;
  selectedPropertyName?: string;
  timeRange?: TimeRange;
};

// -------------------------------
// Portfolio-wide mock series
// -------------------------------
const portfolioSeriesByRange: Record<TimeRange, ApplicationsPoint[]> = {
  "30d": [
    { period: "Week 1", received: 18, approved: 10, declined: 4 },
    { period: "Week 2", received: 15, approved: 9, declined: 3 },
    { period: "Week 3", received: 20, approved: 12, declined: 5 },
    { period: "Week 4", received: 17, approved: 11, declined: 3 },
  ],
  "90d": [
    { period: "Month 1", received: 55, approved: 32, declined: 12 },
    { period: "Month 2", received: 62, approved: 36, declined: 14 },
    { period: "Month 3", received: 59, approved: 34, declined: 13 },
  ],
  ytd: [
    { period: "Q1", received: 140, approved: 80, declined: 35 },
    { period: "Q2", received: 160, approved: 95, declined: 40 },
    { period: "Q3", received: 175, approved: 102, declined: 42 },
    { period: "Q4", received: 90, approved: 55, declined: 22 },
  ],
};

// -------------------------------
// Property-level mock series
// -------------------------------
const propertySeriesByIdAndRange: Record<
  string,
  Partial<Record<TimeRange, ApplicationsPoint[]>>
> = {
  P001: {
    "30d": [
      { period: "Week 1", received: 6, approved: 3, declined: 1 },
      { period: "Week 2", received: 5, approved: 3, declined: 1 },
      { period: "Week 3", received: 7, approved: 4, declined: 2 },
      { period: "Week 4", received: 6, approved: 4, declined: 1 },
    ],
    "90d": [
      { period: "Month 1", received: 20, approved: 11, declined: 4 },
      { period: "Month 2", received: 21, approved: 12, declined: 4 },
      { period: "Month 3", received: 19, approved: 11, declined: 3 },
    ],
  },
  P002: {
    "30d": [
      { period: "Week 1", received: 7, approved: 4, declined: 2 },
      { period: "Week 2", received: 6, approved: 3, declined: 2 },
      { period: "Week 3", received: 8, approved: 5, declined: 2 },
      { period: "Week 4", received: 7, approved: 4, declined: 2 },
    ],
  },
  P003: {
    "30d": [
      { period: "Week 1", received: 5, approved: 3, declined: 1 },
      { period: "Week 2", received: 4, approved: 2, declined: 1 },
      { period: "Week 3", received: 5, approved: 3, declined: 1 },
      { period: "Week 4", received: 4, approved: 3, declined: 0 },
    ],
  },
};

export function DashboardApplicationsChart({
  selectedPropertyId,
  selectedPropertyName,
  timeRange = "30d",
}: DashboardApplicationsChartProps) {
  const portfolioSeries = portfolioSeriesByRange[timeRange] ?? [];

  const propertySeries =
    selectedPropertyId &&
    propertySeriesByIdAndRange[selectedPropertyId] &&
    propertySeriesByIdAndRange[selectedPropertyId]![timeRange];

  const hasPropertySeries =
    propertySeries && Array.isArray(propertySeries) && propertySeries.length > 0;

  const data: ApplicationsPoint[] = hasPropertySeries
    ? propertySeries!
    : portfolioSeries;

  const title = hasPropertySeries
    ? `Applications – ${selectedPropertyName ?? "Property"}`
    : "Applications – Portfolio";

  const subtitle = (() => {
    const rangeLabel =
      timeRange === "30d"
        ? "Last 30 days"
        : timeRange === "90d"
        ? "Last 90 days"
        : "Year to date";

    if (hasPropertySeries) {
      return `${rangeLabel} for this property`;
    }
    return `${rangeLabel} across all properties`;
  })();

  return (
    <div className="dashboard-card applications-card">
      <div className="dashboard-card-header">
        <div>
          <div className="dashboard-card-title">{title}</div>
          <div className="dashboard-card-subtitle">{subtitle}</div>
        </div>
      </div>

      <div className="dashboard-card-body chart-body">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart
            data={data}
            margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="period" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="received" name="Received" stackId="a" />
            <Bar dataKey="approved" name="Approved" stackId="b" />
            <Bar dataKey="declined" name="Declined" stackId="b" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
