// @ts-nocheck
// rentchain-frontend/src/pages/TenantsPage.tsx
import React, { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTenantStore } from "../store/useTenantStore";
import { TenantDetailPanel } from "../components/tenants/TenantDetailPanel";

// TODO later: replace this with real API data
interface Tenant {
  id: string;
  name: string;
  unit?: string;
  propertyName?: string;
  status?: string;
  balance?: number;
}

export const TenantsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const selectedFromUrl = searchParams.get("tenantId");

  const { selectedTenantId, setSelectedTenant } = useTenantStore();

  // TEMP MOCK DATA – we’ll wire API later
  const tenants: Tenant[] = [
    { id: "t1", name: "John Smith", unit: "101", propertyName: "Main St. Apartments", status: "Current", balance: 0 },
    { id: "t2", name: "Sarah Johnson", unit: "302", propertyName: "Downtown Lofts", status: "Late", balance: 450 },
    { id: "t3", name: "Ali Hassan", unit: "204", propertyName: "Harbour View", status: "Current", balance: 0 },
  ];

  // 🔄 Sync URL → global store (and set a default if none)
  useEffect(() => {
    if (selectedFromUrl && selectedFromUrl !== selectedTenantId) {
      setSelectedTenant(selectedFromUrl);
    }

    if (!selectedFromUrl && tenants.length > 0 && !selectedTenantId) {
      const firstId = tenants[0].id;
      setSelectedTenant(firstId);
      navigate(`/tenants?tenantId=${firstId}`, { replace: true });
    }
  }, [selectedFromUrl, selectedTenantId, setSelectedTenant, tenants, navigate]);

  const handleRowClick = (tenantId: string) => {
    setSelectedTenant(tenantId);
    navigate(`/tenants?tenantId=${tenantId}`);
  };

  return (
    <div className="app-root">
      <div className="app-shell">
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: "1.5rem",
          }}
        >
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Tenants</h1>
          <span style={{ opacity: 0.8, fontSize: "0.9rem" }}>
            {tenants.length} active tenants
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 2fr) minmax(0, 3fr)",
            gap: "1.5rem",
          }}
        >
          {/* LEFT: Tenant list */}
          <div
            style={{
              backgroundColor: "rgba(15,23,42,0.7)",
              borderRadius: "0.75rem",
              padding: "1rem",
              boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
              border: "1px solid rgba(148,163,184,0.4)",
            }}
          >
            <div
              style={{
                fontSize: "0.9rem",
                fontWeight: 600,
                marginBottom: "0.75rem",
                opacity: 0.9,
              }}
            >
              Tenant List
            </div>

            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "0.85rem",
                }}
              >
                <thead>
                  <tr style={{ textAlign: "left", opacity: 0.7 }}>
                    <th style={{ padding: "0.5rem" }}>Tenant</th>
                    <th style={{ padding: "0.5rem" }}>Unit</th>
                    <th style={{ padding: "0.5rem" }}>Property</th>
                    <th style={{ padding: "0.5rem", textAlign: "right" }}>
                      Balance
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((tenant) => {
                    const isSelected = tenant.id === selectedTenantId;
                    return (
                      <tr
                        key={tenant.id}
                        onClick={() => handleRowClick(tenant.id)}
                        style={{
                          cursor: "pointer",
                          backgroundColor: isSelected
                            ? "rgba(59,130,246,0.18)"
                            : "transparent",
                          boxShadow: isSelected
                            ? "0 0 0 1px rgba(59,130,246,0.6)"
                            : "none",
                          transition:
                            "background-color 120ms ease, box-shadow 120ms ease",
                        }}
                      >
                        <td style={{ padding: "0.55rem 0.5rem" }}>
                          <div style={{ fontWeight: 600 }}>{tenant.name}</div>
                          <div
                            style={{
                              fontSize: "0.75rem",
                              opacity: 0.7,
                            }}
                          >
                            {tenant.status ?? "—"}
                          </div>
                        </td>
                        <td style={{ padding: "0.55rem 0.5rem" }}>
                          {tenant.unit ?? "—"}
                        </td>
                        <td style={{ padding: "0.55rem 0.5rem" }}>
                          {tenant.propertyName ?? "—"}
                        </td>
                        <td
                          style={{
                            padding: "0.55rem 0.5rem",
                            textAlign: "right",
                          }}
                        >
                          {tenant.balance
                            ? `$${tenant.balance.toLocaleString()}`
                            : "$0"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* RIGHT: Detail panel */}
          <div
            style={{
              backgroundColor: "rgba(15,23,42,0.7)",
              borderRadius: "0.75rem",
              padding: "1.25rem",
              boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
              border: "1px solid rgba(148,163,184,0.4)",
              minHeight: "260px",
            }}
          >
            <div
              style={{
                fontSize: "0.9rem",
                fontWeight: 600,
                marginBottom: "0.75rem",
                opacity: 0.9,
              }}
            >
              Tenant Details
            </div>
            <TenantDetailPanel />
          </div>
        </div>
      </div>
    </div>
  );
};
