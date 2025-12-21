import React from "react";
import { PortfolioKpis } from "../../services/portfolioOverviewApi";

interface Props {
  kpis: PortfolioKpis;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  });
}

export const DashboardPortfolioKpiStrip: React.FC<Props> = ({ kpis }) => {
  return (
    <div className="dashboard-kpi-strip">
      <div className="card kpi-card">
        <div className="kpi-label">Portfolio Occupancy</div>
        <div className="kpi-value">
          {kpis.occupiedUnits} / {kpis.totalUnits}
        </div>
        <div className="kpi-subtext">
          {formatPercent(kpis.occupancyRate)} occupied • {kpis.vacancyCount} vacant
        </div>
      </div>

      <div className="card kpi-card">
        <div className="kpi-label">Properties</div>
        <div className="kpi-value">{kpis.propertiesCount}</div>
        <div className="kpi-subtext">Active in your portfolio</div>
      </div>

      <div className="card kpi-card">
        <div className="kpi-label">MTD Collected</div>
        <div className="kpi-value">
          {formatCurrency(kpis.mtdRentCollected)}
        </div>
        <div className="kpi-subtext">
          of {formatCurrency(kpis.mtdRentDue)} due
        </div>
      </div>

      <div className="card kpi-card">
        <div className="kpi-label">Collection Rate</div>
        <div className="kpi-value">
          {formatPercent(kpis.collectionRate)}
        </div>
        <div className="kpi-subtext">
          {formatCurrency(kpis.mtdOutstanding)} outstanding
        </div>
      </div>
    </div>
  );
};
