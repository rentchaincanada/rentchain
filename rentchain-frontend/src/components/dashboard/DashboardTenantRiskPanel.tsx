import React, { useEffect, useState } from "react";
import {
  fetchTenantOverview,
  TenantOverviewRow,
} from "../../services/tenantOverviewApi";

type TenantRiskLevel = "high" | "medium" | "low";

type TenantRiskRow = TenantOverviewRow & {
  riskLevel: TenantRiskLevel;
  rentchainScore: number; // 300–900 style score
};

type DashboardTenantRiskPanelProps = {
  onSelectTenant?: (tenantId: string) => void;
};

function riskColor(level: TenantRiskLevel) {
  switch (level) {
    case "high":
      return "#e74c3c";
    case "medium":
      return "#e67e22";
    case "low":
      return "#2ecc71";
    default:
      return "#95a5a6";
  }
}

function riskLabel(level: TenantRiskLevel) {
  switch (level) {
    case "high":
      return "High Risk";
    case "medium":
      return "Medium Risk";
    case "low":
      return "Low Risk";
    default:
      return "Unknown";
  }
}

// Simple scoring based on on-time vs late payments
function deriveRiskAndScore(row: TenantOverviewRow): TenantRiskRow {
  const total = row.onTimePayments + row.latePayments;
  const onTimeRatio = total > 0 ? row.onTimePayments / total : 1;

  let riskLevel: TenantRiskLevel;
  if (onTimeRatio >= 0.95) {
    riskLevel = "low";
  } else if (onTimeRatio >= 0.8) {
    riskLevel = "medium";
  } else {
    riskLevel = "high";
  }

  let score = 700 + Math.round((onTimeRatio - 0.9) * 300);
  score = Math.max(400, Math.min(850, score));

  return {
    ...row,
    riskLevel,
    rentchainScore: score,
  };
}

export function DashboardTenantRiskPanel({
  onSelectTenant,
}: DashboardTenantRiskPanelProps) {
  const [tenants, setTenants] = useState<TenantRiskRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);

        const apiRows = await fetchTenantOverview();
        const withRisk = apiRows.map(deriveRiskAndScore);
        setTenants(withRisk);
      } catch (err) {
        console.error("Failed to load tenant overview:", err);
        setError("Unable to load tenant risk overview.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  function handleRowClick(id: string) {
    console.log("[TenantRiskPanel] row clicked:", id);
    if (onSelectTenant) {
      onSelectTenant(id);
    } else {
      console.warn("[TenantRiskPanel] onSelectTenant not provided");
    }
  }

  return (
    <div className="dashboard-card tenant-risk-card">
      <div className="dashboard-card-header">
        <div className="dashboard-card-title">Tenant Risk Overview</div>
        <div className="dashboard-card-subtitle">
          Top tenants to monitor based on payment behaviour
        </div>
      </div>

      <div className="dashboard-card-body tenant-risk-body">
        {loading && <div>Loading tenants…</div>}
        {error && <div className="error-text">{error}</div>}

        {!loading && !error && tenants.length === 0 && (
          <div>No tenants to display yet.</div>
        )}

        {tenants.length > 0 && (
          <table className="tenant-risk-table">
            <thead>
              <tr>
                <th>Tenant</th>
                <th>Property / Unit</th>
                <th>Rent</th>
                <th>On-time</th>
                <th>Late</th>
                <th>Risk</th>
                <th>RentChain Score</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => handleRowClick(t.id)}
                  style={{ cursor: "pointer" }}
                >
                  <td>{t.name}</td>
                  <td>
                    {t.propertyName} · {t.unitLabel}
                  </td>
                  <td>${t.monthlyRent.toLocaleString()}</td>
                  <td>{t.onTimePayments}</td>
                  <td>{t.latePayments}</td>
                  <td>
                    <span
                      style={{
                        backgroundColor: riskColor(t.riskLevel),
                        color: "white",
                        padding: "4px 10px",
                        borderRadius: "12px",
                        fontSize: "12px",
                        fontWeight: 600,
                      }}
                    >
                      {riskLabel(t.riskLevel)}
                    </span>
                  </td>
                  <td>{t.rentchainScore}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
