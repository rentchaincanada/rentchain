// @ts-nocheck
// src/components/tenants/TenantSidebar.tsx
import React from "react";
import type { TenantSummary } from "../../pages/TenantsPage";

interface TenantSidebarProps {
  tenants: TenantSummary[];
  selectedTenantId: string | null;
  onSelectTenant: (id: string) => void;
  loading?: boolean;
}

export const TenantSidebar: React.FC<TenantSidebarProps> = ({
  tenants,
  selectedTenantId,
  onSelectTenant,
  loading = false,
}) => {
  if (loading) {
    return <div className="tenant-sidebar-empty">Loading tenants…</div>;
  }

  if (!tenants || tenants.length === 0) {
    return <div className="tenant-sidebar-empty">No tenants found.</div>;
  }

  return (
    <div className="tenant-sidebar">
      <div className="tenant-sidebar-header">
        <h2>Tenant List</h2>
        <span className="tenant-count">{tenants.length}</span>
      </div>

      <ul className="tenant-list">
        {tenants.map((tenant) => {
          const isActive = tenant.id === selectedTenantId;
          return (
            <li key={tenant.id} className={`tenant-list-item ${isActive ? "active" : ""}`}>
              <button
                type="button"
                className="tenant-list-button"
                onClick={() => onSelectTenant(tenant.id)}
              >
                <div className="tenant-list-name">{tenant.name}</div>
                <div className="tenant-list-meta">
                  {tenant.unit && <span>Unit {tenant.unit}</span>}
                  {tenant.propertyName && <span>• {tenant.propertyName}</span>}
                </div>
                {tenant.status && (
                  <span className={`tenant-status badge status-${tenant.status.toLowerCase()}`}>
                    {tenant.status}
                  </span>
                )}
                {typeof tenant.balance === "number" && (
                  <span
                    className={`tenant-balance ${
                      tenant.balance > 0 ? "negative" : tenant.balance < 0 ? "positive" : "neutral"
                    }`}
                  >
                    {tenant.balance > 0
                      ? `Owes $${tenant.balance.toFixed(2)}`
                      : tenant.balance < 0
                      ? `Credit $${Math.abs(tenant.balance).toFixed(2)}`
                      : "Paid up"}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
