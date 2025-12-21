// src/components/dashboard/TenantRiskTable.tsx

import React from "react";

export interface TenantRiskRow {
  id: string;
  name: string;
  propertyName?: string;
  unit?: string;
  monthlyRent?: number;
  latePayments?: number;
  openIssues?: number;
  riskLevel?: string;   // "Low" | "Medium" | "High" | etc.
  riskScore?: number;
}

interface TenantRiskTableProps {
  tenants?: TenantRiskRow[] | null;
  onSelectTenant: (tenant: TenantRiskRow) => void;
}

export const TenantRiskTable: React.FC<TenantRiskTableProps> = ({
  tenants,
  onSelectTenant,
}) => {
  if (!tenants || tenants.length === 0) {
    return (
      <div className="dashboard-card tenant-risk-card">
        <h2>Tenant Risk</h2>
        <p>No tenant risk data available.</p>
      </div>
    );
  }

  return (
    <div className="dashboard-card tenant-risk-card">
      <h2>Tenant Risk</h2>
      <table className="table compact tenant-risk-table">
        <thead>
          <tr>
            <th>Tenant</th>
            <th>Property / Unit</th>
            <th>Monthly rent</th>
            <th>Late pays</th>
            <th>Open issues</th>
            <th>Risk</th>
            <th>Score</th>
          </tr>
        </thead>
        <tbody>
          {tenants.map((tenant) => (
            <tr
              key={tenant.id}
              className="tenant-risk-row"
              onClick={() => onSelectTenant(tenant)} 
            >
              <td>{tenant.name}</td>
              <td>
                {tenant.propertyName ?? "—"}
                {tenant.unit ? ` · Unit ${tenant.unit}` : ""}
              </td>
              <td>
                {typeof tenant.monthlyRent === "number"
                  ? `$${tenant.monthlyRent.toLocaleString()}`
                  : "—"}
              </td>
              <td>{tenant.latePayments ?? "—"}</td>
              <td>{tenant.openIssues ?? "—"}</td>
              <td>
                <span
                  className={`badge risk-${
                    (tenant.riskLevel ?? "medium").toLowerCase()
                  }`}
                >
                  {tenant.riskLevel ?? "Medium"} Risk
                </span>
              </td>
              <td>{tenant.riskScore ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TenantRiskTable;
