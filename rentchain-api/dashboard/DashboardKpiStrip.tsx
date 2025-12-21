import React, { useEffect, useState } from "react";

type DashboardSummary = {
  portfolioValue: number;
  totalUnits: number;
  occupiedUnits: number;
  occupancyRate: number;
  mtdRentDue: number;
  mtdRentCollected: number;
  mtdCollectionRate: number;
  mtdOutstanding: number;
  next7DaysRentDue: number;
  avgDaysLateLast30: number;
  highRiskTenants: number;
  openMaintenanceTickets: number;
};

type DashboardOverviewResponse = {
  asOf: string;
  timeRange: string;
  landlordId: string;
  summary: DashboardSummary;
};

type KpiCardConfig = {
  key: keyof DashboardSummary | "occupancyComposite";
  label: string;
  format: (value: number, summary: DashboardSummary) => string;
  subLabel?: (summary: DashboardSummary) => string | undefined;
};

const KPI_CARDS: KpiCardConfig[] = [
  {
    key: "portfolioValue",
    label: "Portfolio Value",
    format: (value) => formatCurrency(value),
  },
  {
    key: "occupancyComposite",
    label: "Occupancy",
    format: (_, summary) => formatPercent(summary.occupancyRate),
    subLabel: (summary) =>
      `${summary.occupiedUnits} / ${summary.totalUnits} units`,
  },
  {
    key: "mtdRentCollected",
    label: "MTD Collection",
    format: (value, summary) =>
      `${formatCurrency(value)} / ${formatCurrency(summary.mtdRentDue)}`,
    subLabel: (summary) =>
      `Collection rate ${formatPercent(summary.mtdCollectionRate)}`,
  },
  {
    key: "mtdOutstanding",
    label: "MTD Outstanding",
    format: (value) => formatCurrency(value),
  },
  {
    key: "next7DaysRentDue",
    label: "Next 7 Days Rent Due",
    format: (value) => formatCurrency(value),
  },
  {
    key: "avgDaysLateLast30",
    label: "Avg Days Late (30d)",
    format: (value) => `${value.toFixed(1)} days`,
  },
  {
    key: "highRiskTenants",
    label: "High-Risk Tenants",
    format: (value) => formatNumber(value),
  },
  {
    key: "openMaintenanceTickets",
    label: "Open Maintenance Tickets",
    format: (value) => formatNumber(value),
  },
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-CA").format(value);
}

export const DashboardKpiStrip: React.FC = () => {
  const [data, setData] = useState<DashboardOverviewResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchKpis = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch("http://localhost:3000/dashboard/overview");
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const json = (await response.json()) as DashboardOverviewResponse;
        setData(json);
      } catch (err: any) {
        console.error("Failed to fetch dashboard overview:", err);
        setError("Failed to load KPIs. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchKpis();
  }, []);

  if (loading) {
    return (
      <div className="kpi-strip kpi-strip--loading">
        <p>Loading KPIs…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="kpi-strip kpi-strip--error">
        <p>{error ?? "No data available."}</p>
      </div>
    );
  }

  const { summary, asOf, timeRange } = data;

  return (
    <section className="kpi-strip">
      <div className="kpi-strip__meta">
        <h2 className="kpi-strip__title">Portfolio Overview</h2>
        <div className="kpi-strip__subtitle">
          <span>As of {asOf}</span>
          <span className="kpi-strip__dot">•</span>
          <span>Last {timeRange}</span>
        </div>
      </div>

      <div className="kpi-strip__grid">
        {KPI_CARDS.map((card) => {
          const value =
            card.key === "occupancyComposite"
              ? summary.occupancyRate
              : summary[card.key as keyof DashboardSummary];

          return (
            <div key={card.label} className="kpi-card">
              <div className="kpi-card__label">{card.label}</div>
              <div className="kpi-card__value">
                {card.format(value as number, summary)}
              </div>
              {card.subLabel && (
                <div className="kpi-card__sublabel">
                  {card.subLabel(summary)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
