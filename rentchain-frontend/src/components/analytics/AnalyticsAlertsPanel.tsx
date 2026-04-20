import React from "react";
import { Link } from "react-router-dom";
import type { AnalyticsAlert } from "@/api/landlordAnalyticsAlertsApi";
import { Card } from "../ui/Ui";

const severityColors: Record<AnalyticsAlert["severity"], { bg: string; text: string }> = {
  low: { bg: "rgba(14, 165, 233, 0.12)", text: "#075985" },
  medium: { bg: "rgba(245, 158, 11, 0.14)", text: "#92400e" },
  high: { bg: "rgba(239, 68, 68, 0.12)", text: "#991b1b" },
};

type Props = {
  alerts: AnalyticsAlert[];
  summary?: {
    activeCount: number;
    highSeverityCount: number;
    mediumSeverityCount: number;
    lowSeverityCount: number;
  } | null;
};

export function AnalyticsAlertsPanel({ alerts, summary }: Props) {
  return (
    <Card>
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "grid", gap: 4 }}>
          <h2 style={{ margin: 0, fontSize: "1.05rem" }}>Analytics alerts</h2>
          <div style={{ color: "#475569" }}>
            Focused portfolio conditions that need attention now.
          </div>
        </div>

        {summary ? (
          <div style={{ color: "#64748b", fontSize: "0.9rem" }}>
            {summary.activeCount} active alerts
            {summary.highSeverityCount ? ` · ${summary.highSeverityCount} high` : ""}
            {summary.mediumSeverityCount ? ` · ${summary.mediumSeverityCount} medium` : ""}
            {summary.lowSeverityCount ? ` · ${summary.lowSeverityCount} low` : ""}
          </div>
        ) : null}

        {alerts.length === 0 ? (
          <div style={{ color: "#64748b" }}>No analytics alerts right now.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {alerts.map((alert) => (
              <div
                key={alert.id}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  padding: 14,
                  display: "grid",
                  gap: 8,
                  background: "#fff",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ display: "grid", gap: 4 }}>
                    <div style={{ fontWeight: 700, color: "#0f172a" }}>{alert.title}</div>
                    <div style={{ color: "#475569" }}>{alert.message}</div>
                  </div>
                  <div
                    style={{
                      padding: "5px 10px",
                      borderRadius: 999,
                      background: severityColors[alert.severity].bg,
                      color: severityColors[alert.severity].text,
                      fontWeight: 700,
                      fontSize: "0.78rem",
                      textTransform: "uppercase",
                    }}
                  >
                    {alert.severity}
                  </div>
                </div>
                {alert.actions?.length ? (
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {alert.actions.map((action) =>
                      action.href ? (
                        <Link key={`${alert.id}-${action.type}`} to={action.href} style={{ color: "#2563eb", fontWeight: 600 }}>
                          {action.label}
                        </Link>
                      ) : (
                        <span key={`${alert.id}-${action.type}`} style={{ color: "#2563eb", fontWeight: 600 }}>
                          {action.label}
                        </span>
                      )
                    )}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

export default AnalyticsAlertsPanel;
