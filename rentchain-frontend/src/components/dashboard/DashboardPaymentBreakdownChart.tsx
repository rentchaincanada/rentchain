// src/components/dashboard/DashboardPaymentBreakdownChart.tsx
import React from "react";
import { PaymentBreakdown } from "../../services/dashboardOverviewService";

type DashboardPaymentBreakdownChartProps = {
  breakdown?: PaymentBreakdown;
  loading?: boolean;
  error?: string | null;
};

export function DashboardPaymentBreakdownChart({
  breakdown,
  loading,
  error,
}: DashboardPaymentBreakdownChartProps) {
  if (loading) {
    return (
      <div className="dashboard-card chart-card">
        <div className="dashboard-card-header">
          <div className="dashboard-card-title">Payment Breakdown – Portfolio</div>
          <div className="dashboard-card-subtitle">
            Distribution of payments by status
          </div>
        </div>
        <div className="dashboard-card-body">
          <div>Loading payment breakdown…</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-card chart-card">
        <div className="dashboard-card-header">
          <div className="dashboard-card-title">Payment Breakdown – Portfolio</div>
        </div>
        <div className="dashboard-card-body">
          <div className="error-text">Failed to load payment breakdown.</div>
        </div>
      </div>
    );
  }

  if (!breakdown) {
    return (
      <div className="dashboard-card chart-card">
        <div className="dashboard-card-header">
          <div className="dashboard-card-title">Payment Breakdown – Portfolio</div>
        </div>
        <div className="dashboard-card-body">
          <div className="empty-state">No payment data available.</div>
        </div>
      </div>
    );
  }

  const { onTime, gracePeriod, late, veryLate } = breakdown;
  const total = onTime + gracePeriod + late + veryLate || 1;

  const segments = [
    { key: "onTime", label: "On time", value: onTime, className: "seg-on-time" },
    {
      key: "gracePeriod",
      label: "Within grace period",
      value: gracePeriod,
      className: "seg-grace",
    },
    { key: "late", label: "Late", value: late, className: "seg-late" },
    { key: "veryLate", label: "Very late", value: veryLate, className: "seg-very-late" },
  ];

  return (
    <div className="dashboard-card chart-card">
      <div className="dashboard-card-header">
        <div className="dashboard-card-title">Payment Breakdown – Portfolio</div>
        <div className="dashboard-card-subtitle">
          Share of payments by timeliness
        </div>
      </div>

      <div className="dashboard-card-body">
        <div className="payment-breakdown-bar">
          {segments.map((seg) => {
            const pct = (seg.value / total) * 100;
            if (pct <= 0) return null;
            return (
              <div
                key={seg.key}
                className={`payment-breakdown-segment ${seg.className}`}
                style={{ width: `${pct}%` }}
                title={`${seg.label}: ${seg.value} (${pct.toFixed(0)}%)`}
              />
            );
          })}
        </div>

        <div className="payment-breakdown-legend">
          {segments.map((seg) => (
            <div key={seg.key} className="payment-breakdown-legend-item">
              <span className={`legend-color ${seg.className}`} />
              <span className="legend-label">
                {seg.label} – {seg.value} (
                {((seg.value / total) * 100).toFixed(0)}
                %)
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
