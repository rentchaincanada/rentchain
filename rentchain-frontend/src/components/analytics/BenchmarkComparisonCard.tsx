import React from "react";
import type { LandlordBenchmarkingComparison } from "@/api/landlordAnalyticsBenchmarkingApi";

function formatPercent(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${Math.round(value * 100)}%`;
}

function formatCurrency(cents: number | null | undefined) {
  if (typeof cents !== "number" || !Number.isFinite(cents)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
    cents / 100
  );
}

function directionLabel(direction: string) {
  if (direction === "better") return "Better than portfolio average";
  if (direction === "worse") return "Worse than portfolio average";
  if (direction === "neutral") return "In line with portfolio average";
  return "Not enough portfolio data yet";
}

type Props = {
  comparison: LandlordBenchmarkingComparison;
};

export function BenchmarkComparisonCard({ comparison }: Props) {
  const vacancy = comparison.benchmarks.vacancyRate;
  const applicationConversion = comparison.benchmarks.applicationConversionRate;
  const maintenance = comparison.benchmarks.maintenanceCostCents;
  const rent = comparison.benchmarks.estimatedRentPerOccupiedUnitCents;

  const rows = [
    {
      label: "Vacancy rate",
      value: formatPercent(comparison.metrics.vacancyRate),
      hint:
        vacancy?.portfolioAverage != null
          ? `Portfolio avg ${formatPercent(vacancy.portfolioAverage)} · ${directionLabel(vacancy.direction)}`
          : "No portfolio average yet",
    },
    {
      label: "Application conversion",
      value: formatPercent(comparison.metrics.applicationConversionRate),
      hint:
        applicationConversion?.portfolioAverage != null
          ? `Portfolio avg ${formatPercent(applicationConversion.portfolioAverage)} · ${directionLabel(applicationConversion.direction)}`
          : "Not enough applications to compare yet",
    },
    {
      label: "Maintenance cost",
      value: formatCurrency(comparison.metrics.maintenanceCostCents),
      hint:
        maintenance?.portfolioAverage != null
          ? `Portfolio avg ${formatCurrency(maintenance.portfolioAverage)} · ${directionLabel(maintenance.direction)}`
          : "No portfolio average yet",
    },
    {
      label: "Rent per occupied unit",
      value: formatCurrency(comparison.metrics.estimatedRentPerOccupiedUnitCents),
      hint:
        rent?.portfolioAverage != null
          ? `Portfolio avg ${formatCurrency(rent.portfolioAverage)} · ${directionLabel(rent.direction)}`
          : "No rent comparison yet",
    },
  ];

  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        padding: 14,
        display: "grid",
        gap: 10,
        background: "#fff",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ fontWeight: 700, color: "#0f172a" }}>{comparison.propertyName}</div>
          <div style={{ color: "#64748b", fontSize: "0.9rem" }}>
            {comparison.metrics.occupiedUnits} occupied · {comparison.metrics.vacantUnits} vacant
          </div>
        </div>
        {vacancy?.rank ? (
          <div
            style={{
              padding: "5px 10px",
              borderRadius: 999,
              background: "rgba(30, 95, 78, 0.12)",
              color: "#1e5f4e",
              fontWeight: 700,
              fontSize: "0.78rem",
            }}
          >
            Vacancy rank #{vacancy.rank}
          </div>
        ) : null}
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        {rows.map((row) => (
          <div
            key={row.label}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 16,
              borderTop: "1px solid #e2e8f0",
              paddingTop: 10,
            }}
          >
            <div style={{ display: "grid", gap: 2 }}>
              <div style={{ fontWeight: 600, color: "#0f172a" }}>{row.label}</div>
              <div style={{ color: "#64748b", fontSize: "0.88rem" }}>{row.hint}</div>
            </div>
            <div style={{ fontWeight: 700, color: "#0f172a", textAlign: "right" }}>{row.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default BenchmarkComparisonCard;
