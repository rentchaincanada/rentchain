import React from "react";

export type PortfolioHealthKpis = {
  occupancyRate?: number;   // 0–1
  collectionRate?: number;  // 0–1
  totalUnits?: number;
};

type DashboardAlertsPanelProps = {
  kpis?: PortfolioHealthKpis;
  selectedPropertyName?: string;
};

type HealthAlert = {
  id: string;
  type: "risk" | "opportunity" | "info";
  severity: "low" | "medium" | "high";
  message: string;
};

function buildAlerts(
  kpis: PortfolioHealthKpis | undefined,
  scopeLabel: string
): HealthAlert[] {
  if (!kpis) {
    return [
      {
        id: "no-kpis",
        type: "info",
        severity: "low",
        message: `No KPI data available yet for ${scopeLabel}. Once payments and occupancy data are flowing, this panel will surface risks and opportunities automatically.`,
      },
    ];
  }

  const { occupancyRate, collectionRate, totalUnits } = kpis;

  const alerts: HealthAlert[] = [];

  const label =
    scopeLabel === "Portfolio (all properties)" ? "your portfolio" : scopeLabel;

  // Collection rate analysis
  if (typeof collectionRate === "number") {
    if (collectionRate < 0.9) {
      alerts.push({
        id: "collection-critical",
        type: "risk",
        severity: "high",
        message: `Collection rate is below 90% for ${label}. This is a critical warning – late or missed payments are materially impacting cashflow.`,
      });
    } else if (collectionRate < 0.95) {
      alerts.push({
        id: "collection-watch",
        type: "risk",
        severity: "medium",
        message: `Collection rate is between 90–95% for ${label}. Consider tightening follow-up on late payments and reviewing higher-risk tenants.`,
      });
    } else {
      alerts.push({
        id: "collection-strong",
        type: "opportunity",
        severity: "low",
        message: `Collection rate is strong (95%+). This stability can support refinancing, capital upgrades, or expansion plans.`,
      });
    }
  }

  // Occupancy analysis
  if (typeof occupancyRate === "number") {
    if (occupancyRate < 0.9) {
      alerts.push({
        id: "occupancy-low",
        type: "risk",
        severity: "medium",
        message: `Occupancy appears below 90% for ${label}. Review pricing, marketing, and unit turn-around times to reduce vacancy.`,
      });
    } else if (occupancyRate > 0.97) {
      alerts.push({
        id: "occupancy-high",
        type: "opportunity",
        severity: "low",
        message: `Occupancy is very high (97%+). You may have room to test modest rent increases on new leases or renewals.`,
      });
    }
  }

  // Portfolio scale note
  if (typeof totalUnits === "number" && totalUnits >= 20) {
    alerts.push({
      id: "scale-note",
      type: "info",
      severity: "low",
      message: `With approximately ${totalUnits} units, small percentage changes in occupancy or collection can have a meaningful impact on monthly NOI.`,
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      id: "stable",
      type: "info",
      severity: "low",
      message: `${label} appears stable based on current KPIs. Continue monitoring trends over the next 30–90 days.`,
    });
  }

  return alerts;
}

export function DashboardAlertsPanel({
  kpis,
  selectedPropertyName,
}: DashboardAlertsPanelProps) {
  const scopeLabel =
    selectedPropertyName ?? "Portfolio (all properties)";

  const alerts = buildAlerts(kpis, scopeLabel);

  return (
    <div className="dashboard-card alerts-card">
      <div className="dashboard-card-header">
        <div className="dashboard-card-title">Portfolio Alerts</div>
        <div className="dashboard-card-subtitle">
          Risk & opportunity signals for {scopeLabel}
        </div>
      </div>

      <div className="dashboard-card-body alerts-body">
        <ul className="alerts-list">
          {alerts.map((alert) => (
            <li
              key={alert.id}
              className={`alert-item alert-${alert.type} alert-${alert.severity}`}
            >
              <div className="alert-tag">
                {alert.type.toUpperCase()} · {alert.severity.toUpperCase()}
              </div>
              <div className="alert-message">{alert.message}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
