// src/components/tenants/TenantDetailPanel.tsx
import React, { useEffect, useState, useMemo } from "react";
import { TenantRiskRow } from "../dashboard/TenantRiskTable";
import "../dashboard/Dashboard.css";

interface TenantDetailPanelProps {
  tenantId: string | null;
  tenants: TenantRiskRow[];
  loadingTenants?: boolean;
}

interface TenantPayment {
  id: string;
  tenantId?: string;
  propertyId?: string;
  amount: number;
  dueDate?: string;
  paidAt?: string;
  status?: string;
  notes?: string;
  method?: string;
}

export const TenantDetailPanel: React.FC<TenantDetailPanelProps> = ({
  tenantId,
  tenants,
  loadingTenants = false,
}) => {
  const [payments, setPayments] = useState<TenantPayment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);

  // Select the active tenant
  const selectedTenant = useMemo(
    () => tenants.find((t) => t.id === tenantId) ?? null,
    [tenants, tenantId]
  );

  // Load recent payments
  useEffect(() => {
    if (!tenantId) {
      setPayments([]);
      return;
    }

    const loadPayments = async () => {
      try {
        setLoadingPayments(true);

        const url = `/payments?tenantId=${tenantId}`;
        console.log("TenantDetailPanel fetching:", url);
        const res = await fetch(url);

        if (!res.ok) {
          console.error("Failed to fetch payments", await res.text());
          setPayments([]);
          return;
        }

        const data = await res.json();

        // Accept ANY backend shape:
        // 1) Array of payments → [ ... ]
        // 2) Wrapped response → { payments: [ ... ] }
        const paymentsData = Array.isArray(data)
          ? data
          : data && Array.isArray(data.payments)
          ? data.payments
          : [];

        setPayments(paymentsData);
      } catch (err) {
        console.error("Error loading payments", err);
        setPayments([]);
      } finally {
        setLoadingPayments(false);
      }
    };

    loadPayments();
  }, [tenantId]);

  async function refetchPayments() {
    if (!tenantId) {
      setPayments([]);
      return;
    }
    try {
      setLoadingPayments(true);
      const url = `/payments?tenantId=${tenantId}`;
      const res = await fetch(url);
      if (!res.ok) {
        setPayments([]);
        return;
      }
      const data = await res.json();
      const paymentsData = Array.isArray(data)
        ? data
        : data && Array.isArray(data.payments)
        ? data.payments
        : [];
      setPayments(paymentsData);
    } catch {
      setPayments([]);
    } finally {
      setLoadingPayments(false);
    }
  }

  // Loading state for tenant list
  if (loadingTenants) {
    return (
      <div className="card tenant-detail-panel">
        <h2>Tenant details</h2>
        <p className="subtle-loading">Loading tenants…</p>
      </div>
    );
  }

  // No tenant selected yet
  if (!tenantId) {
    return (
      <div className="card tenant-detail-panel">
        <h2>Tenant details</h2>
        <p>Select a tenant from the table to view details.</p>
      </div>
    );
  }

  if (!selectedTenant) {
    return (
      <div className="card tenant-detail-panel">
        <h2>Tenant details</h2>
        <p>Tenant not found.</p>
      </div>
    );
  }

  // Successful render
  return (
    <div className="card tenant-detail-panel">
      <h2>Tenant details</h2>

      {/* Tiny debug line directly in the UI */}
      <p style={{ fontSize: "0.75rem", opacity: 0.7, marginBottom: "0.75rem" }}>
        Debug – tenantId: <code>{String(tenantId)}</code>, payments:{" "}
        <code>{payments.length}</code>
      </p>

      {/* Basic tenant info */}
      <p>
        <strong>Name:</strong> {selectedTenant.name}
      </p>
      <p>
        <strong>Property:</strong> {selectedTenant.propertyName}
      </p>
      <p>
        <strong>Unit:</strong> {selectedTenant.unit}
      </p>
      <p>
        <strong>Monthly Rent:</strong> ${selectedTenant.monthlyRent}
      </p>
      <p>
        <strong>Risk Level:</strong> {selectedTenant.riskLevel}
      </p>
      <div style={{ marginTop: "0.5rem", marginBottom: "0.5rem" }}>
        <button
          type="button"
          onClick={() => setShowEventModal(true)}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #e5e7eb",
            background: "#111827",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          Record event
        </button>
      </div>

      {/* Recent Payments */}
      <div className="panel-section" style={{ marginTop: "1.5rem" }}>
        <h3 className="section-title">Recent Payments</h3>

        {loadingPayments ? (
          <div className="loading">Loading payments…</div>
        ) : payments.length === 0 ? (
          <div className="empty">No payments recorded</div>
        ) : (
          <table className="payments-table">
            <thead>
              <tr>
                <th>Paid At</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Status</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.paidAt
                      ? new Date(p.paidAt).toLocaleDateString()
                      : "-"}
                  </td>
                  <td>
                    {typeof p.amount === "number"
                      ? `$${p.amount.toLocaleString()}`
                      : "-"}
                  </td>
                  <td>{p.method || "-"}</td>
                  <td>
                    <span
                      className={`status-tag ${
                        p.status === "late"
                          ? "late"
                          : p.status === "on-time"
                          ? "on-time"
                          : "pending"
                      }`}
                    >
                      {p.status || "pending"}
                    </span>
                  </td>
                  <td>{p.notes || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
      {showEventModal ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 2000,
          }}
          onMouseDown={() => setShowEventModal(false)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: 16,
              width: "100%",
              maxWidth: 480,
              boxShadow: "0 20px 50px rgba(0,0,0,0.15)",
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontWeight: 700 }}>Record tenant event</div>
              <button
                type="button"
                onClick={() => setShowEventModal(false)}
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: 16,
                }}
              >
                ×
              </button>
            </div>
            <RecordTenantEventModal
              tenantId={tenantId}
              onSuccess={async () => {
                setShowEventModal(false);
                await refetchPayments();
              }}
              onClose={() => setShowEventModal(false)}
            />
          </div>
        </div>
      ) : null}
  );
};

export default TenantDetailPanel;
import { RecordTenantEventModal } from "../tenant/RecordTenantEventModal";
