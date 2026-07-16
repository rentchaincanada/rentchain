import React from "react";
import { Card } from "../ui/Ui";
import type { LandlordPredictiveMetric } from "@/api/landlordAnalyticsApi";
import {
  formatPredictiveSupportingValues,
  predictiveMetricNextReviewCopy,
} from "@/lib/analytics/analyticsInsightCopy";

const riskTone: Record<"low" | "medium" | "high", { bg: string; text: string }> = {
  low: { bg: "rgba(30, 95, 78, 0.12)", text: "#1e5f4e" },
  medium: { bg: "rgba(245, 158, 11, 0.14)", text: "#92400e" },
  high: { bg: "rgba(239, 68, 68, 0.12)", text: "#991b1b" },
};

type Props = {
  metrics: LandlordPredictiveMetric[];
};

export function PredictiveMetricsPanel({ metrics }: Props) {
  return (
    <Card>
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "grid", gap: 4 }}>
          <h2 style={{ margin: 0, fontSize: "1.05rem" }}>Predictive metrics</h2>
          <div style={{ color: "#475569" }}>
            Near-term portfolio signals derived from current analytics, prior-period deltas, and property-level patterns.
          </div>
        </div>

        {!metrics.length ? (
          <div style={{ color: "#64748b" }}>No predictive metrics are available for this view yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {metrics.map((metric) => {
              const support = formatPredictiveSupportingValues(metric);
              return (
                <div
                  key={metric.key}
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: 12,
                    padding: 14,
                    background: "#fff",
                    display: "grid",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 700, color: "#0f172a" }}>{metric.label}</div>
                    {metric.status === "insufficient_data" ? (
                      <div style={{ color: "#64748b", fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase" }}>
                        Insufficient data
                      </div>
                    ) : metric.riskLevel ? (
                      <div
                        style={{
                          padding: "4px 9px",
                          borderRadius: 999,
                          background: riskTone[metric.riskLevel].bg,
                          color: riskTone[metric.riskLevel].text,
                          fontWeight: 700,
                          fontSize: "0.78rem",
                          textTransform: "uppercase",
                        }}
                      >
                        {metric.riskLevel} risk
                      </div>
                    ) : null}
                  </div>
                  <div style={{ color: "#334155" }}>{metric.explanation}</div>
                  {support ? <div style={{ color: "#64748b", fontSize: "0.88rem" }}>{support}</div> : null}
                  <div style={{ color: "#334155", fontSize: "0.88rem", fontWeight: 600 }}>
                    {predictiveMetricNextReviewCopy(metric)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}

export default PredictiveMetricsPanel;
