import React from "react";
import { Card } from "../ui/Ui";
import type { AnalyticsDeltaValue } from "@/api/landlordAnalyticsApi";
import TrendDeltaBadge from "./TrendDeltaBadge";

type Metric = {
  label: string;
  value: string;
  hint?: string;
  delta?: AnalyticsDeltaValue | null;
  formatAbsoluteDelta?: (value: number) => string | null;
};

type Props = {
  title: string;
  description: string;
  metrics: Metric[];
  emptyMessage?: string;
  periodLabel?: string;
};

export function AnalyticsSectionPanel({ title, description, metrics, emptyMessage, periodLabel = "period" }: Props) {
  return (
    <Card>
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "grid", gap: 4 }}>
          <h2 style={{ margin: 0, fontSize: "1.05rem" }}>{title}</h2>
          <div style={{ color: "#475569" }}>{description}</div>
        </div>

        {metrics.length === 0 ? (
          <div style={{ color: "#64748b" }}>{emptyMessage || "No analytics available for this section yet."}</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {metrics.map((metric) => (
              <div
                className="analytics-section-metric-row"
                key={metric.label}
                style={{
                  gap: 16,
                  padding: "10px 0",
                  borderTop: "1px solid #e2e8f0",
                }}
              >
                <div className="analytics-section-metric-row__body" style={{ display: "grid", gap: 2 }}>
                  <div style={{ fontWeight: 600, color: "#0f172a" }}>{metric.label}</div>
                  {metric.hint ? <div style={{ color: "#64748b", fontSize: "0.88rem" }}>{metric.hint}</div> : null}
                  <TrendDeltaBadge
                    delta={metric.delta}
                    periodLabel={periodLabel}
                    formatAbsoluteDelta={metric.formatAbsoluteDelta}
                  />
                </div>
                <div className="analytics-section-metric-row__value" style={{ fontWeight: 700, color: "#0f172a" }}>
                  {metric.value}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

export default AnalyticsSectionPanel;
