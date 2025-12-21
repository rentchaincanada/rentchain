// src/components/dashboard/TenantRiskTable.tsx
import React from "react";
import { TenantRiskRow } from "../../services/dashboardOverviewService";

type TenantRiskTableProps = {
  tenants?: TenantRiskRow[];
  onSelectTenant?: (tenantId: string) => void;
};

export function TenantRiskTable({
  tenants = [],
  onSelectTenant,
}: TenantRiskTableProps) {
  const hasRows = tenants.length > 0;

  return (
    <div className="dashboard-card tenant-risk-card">
      <div className="dashboard-card-header">
        <div className="dashboard-card-title">Tenant Risk Overview</div>
        <div className="dashboard-card-subtitle">
          Top tenants to monitor based on payment behaviour
        </div>
      </div>

      <div className="dashboard-card-body">
        {!hasRows && <div className="empty-state">No tenant risk signals.</div>}

        {hasRows && (
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
                  className={onSelectTenant ? "clickable-row" : undefined}
                  onClick={() => onSelectTenant && onSelectTenant(t.id)}
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
                      className={`risk-pill risk-${t.riskLevel.toLowerCase()}`}
                    >
                      {t.riskLevel}
                    </span>
                  </td>
                  <td>{t.rentChainScore}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
