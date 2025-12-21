import React from "react";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

export type RentCollectionPoint = {
  date: string;
  due: number;
  collected: number;
};

type DashboardRentCollectionChartProps = {
  selectedPropertyId?: string;
  selectedPropertyName?: string;
};

// -------------------------------
// Portfolio-wide mock data
// -------------------------------
const portfolioSeries: RentCollectionPoint[] = [
  { date: "Nov 01", due: 36000, collected: 34500 },
  { date: "Nov 08", due: 36000, collected: 33900 },
  { date: "Nov 15", due: 36000, collected: 35100 },
  { date: "Nov 22", due: 36000, collected: 34800 },
  { date: "Nov 29", due: 36000, collected: 35400 },
];

// -------------------------------
// Property-level mock data
// -------------------------------
const propertySeriesById: Record<string, RentCollectionPoint[]> = {
  P001: [
    { date: "Nov 01", due: 12000, collected: 11800 },
    { date: "Nov 08", due: 12000, collected: 11500 },
    { date: "Nov 15", due: 12000, collected: 11950 },
    { date: "Nov 22", due: 12000, collected: 11850 },
    { date: "Nov 29", due: 12000, collected: 11975 },
  ],

  P002: [
    { date: "Nov 01", due: 15000, collected: 14300 },
    { date: "Nov 08", due: 15000, collected: 14150 },
    { date: "Nov 15", due: 15000, collected: 14600 },
    { date: "Nov 22", due: 15000, collected: 14550 },
    { date: "Nov 29", due: 15000, collected: 14700 },
  ],

  P003: [
    { date: "Nov 01", due: 9000, collected: 8400 },
    { date: "Nov 08", due: 9000, collected: 8450 },
    { date: "Nov 15", due: 9000, collected: 8550 },
    { date: "Nov 22", due: 9000, collected: 8500 },
    { date: "Nov 29", due: 9000, collected: 8600 },
  ],
};

// -------------------------------
// Component
// -------------------------------
export function DashboardRentCollectionChart({
  selectedPropertyId,
  selectedPropertyName,
}: DashboardRentCollectionChartProps) {
  const hasPropertySeries =
    selectedPropertyId && propertySeriesById[selectedPropertyId];

  const data: RentCollectionPoint[] = hasPropertySeries
    ? propertySeriesById[selectedPropertyId!]
    : portfolioSeries;

  const title = hasPropertySeries
    ? `Rent Collection – ${selectedPropertyName ?? "Property"}`
    : "Rent Collection – Portfolio";

  const subtitle = hasPropertySeries
    ? "Last 5 weeks for this property"
    : "Last 5 weeks across all properties";

  return (
    <div className="dashboard-card rent-collection-card">
      <div className="dashboard-card-header">
        <div>
          <div className="dashboard-card-title">{title}</div>
          <div className="dashboard-card-subtitle">{subtitle}</div>
        </div>
      </div>

      <div className="dashboard-card-body chart-body">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart
            data={data}
            margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" />
            <YAxis
              tickFormatter={(value: number) =>
                `$${value.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}`
              }
            />
            <Tooltip
              formatter={(value: any) =>
                `$${Number(value).toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}`
              }
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="due"
              name="Due"
              dot={false}
              strokeWidth={2}
            />
            <Line
              type="monotone"
              dataKey="collected"
              name="Collected"
              dot={false}
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
