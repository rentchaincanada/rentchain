import React from "react";
import type { LandlordAnalyticsBenchmarkingResponse } from "@/api/landlordAnalyticsBenchmarkingApi";
import { Card } from "../ui/Ui";
import BenchmarkComparisonCard from "./BenchmarkComparisonCard";

const severityColors: Record<"low" | "medium" | "high", { bg: string; text: string }> = {
  low: { bg: "rgba(30, 95, 78, 0.12)", text: "#1e5f4e" },
  medium: { bg: "rgba(245, 158, 11, 0.14)", text: "#92400e" },
  high: { bg: "rgba(239, 68, 68, 0.12)", text: "#991b1b" },
};

type Props = {
  benchmarking: LandlordAnalyticsBenchmarkingResponse | null;
};

export function PortfolioBenchmarkingPanel({ benchmarking }: Props) {
  if (!benchmarking) return null;

  const showEmpty =
    benchmarking.summary.propertyCount < 2 || benchmarking.summary.comparedPropertyCount === 0;

  return (
    <Card>
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "grid", gap: 4 }}>
          <h2 style={{ margin: 0, fontSize: "1.05rem" }}>Portfolio benchmarking</h2>
          <div style={{ color: "#475569" }}>
            Compare each property against the rest of your portfolio using the same analytics foundation.
          </div>
        </div>

        {showEmpty ? (
          <div style={{ color: "#64748b" }}>
            Benchmarking becomes available when you have more than one active property with enough activity to compare.
          </div>
        ) : (
          <>
            {benchmarking.insights.length ? (
              <div style={{ display: "grid", gap: 8 }}>
                {benchmarking.insights.map((insight, index) => (
                  <div
                    key={`${insight.type}-${insight.propertyId || "portfolio"}-${index}`}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      flexWrap: "wrap",
                      padding: "10px 12px",
                      borderRadius: 12,
                      background: "#fffaf1",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    <div style={{ color: "#334155" }}>{insight.message}</div>
                    <div
                      style={{
                        padding: "4px 9px",
                        borderRadius: 999,
                        background: severityColors[insight.severity].bg,
                        color: severityColors[insight.severity].text,
                        fontWeight: 700,
                        fontSize: "0.78rem",
                        textTransform: "uppercase",
                      }}
                    >
                      {insight.severity}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            <div
              style={{
                display: "grid",
                gap: 12,
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              }}
            >
              {benchmarking.comparisons.map((comparison) => (
                <BenchmarkComparisonCard key={comparison.propertyId} comparison={comparison} />
              ))}
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

export default PortfolioBenchmarkingPanel;
