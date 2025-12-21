// @ts-nocheck
import React, { useEffect, useState } from "react";
import {
  fetchTenantDetail,
  TenantDetail,
} from "../../services/tenantDetailApi";
import { TopNav } from "../components/layout/TopNav";
type DashboardTenantDetailPanelProps = {
  tenantId?: string;
};

export function DashboardTenantDetailPanel({
  tenantId,
}: DashboardTenantDetailPanelProps) {
  const [detail, setDetail] = useState<TenantDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) {
      // No tenant selected – reset state
      setDetail(null);
      setError(null);
      return;
    }

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const d = await fetchTenantDetail(tenantId);
        setDetail(d);
      } catch (err) {
        console.error("Failed to load tenant detail:", err);
        setError("Unable to load tenant details.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [tenantId]);

  return (
    <div className="dashboard-card tenant-detail-card">
      <div className="dashboard-card-header">
        <div className="dashboard-card-title">
          {detail ? `Tenant Detail – ${detail.name}` : "Tenant Detail"}
        </div>
        <div className="dashboard-card-subtitle">
          Payment history & lease info
        </div>
      </div>

      <div className="dashboard-card-body tenant-detail-body">
        {!tenantId && <div>Select a tenant to view details.</div>}
        {tenantId && loading && <div>Loading tenant details…</div>}
        {tenantId && error && <div className="error-text">{error}</div>}

        {detail && !loading && !error && (
          <>
            <div className="tenant-detail-summary">
              <div>
                <strong>Property:</strong> {detail.propertyName}
              </div>
              <div>
                <strong>Unit:</strong> {detail.unitLabel}
              </div>
              <div>
                <strong>Monthly Rent:</strong>{" "}
                ${detail.monthlyRent.toLocaleString()}
              </div>
              {detail.email && (
                <div>
                  <strong>Email:</strong> {detail.email}
                </div>
              )}
              {detail.phone && (
                <div>
                  <strong>Phone:</strong> {detail.phone}
                </div>
              )}
              <div>
                <strong>Lease:</strong> {detail.leaseStart}{" "}
                {detail.leaseEnd ? `– ${detail.leaseEnd}` : ""}
              </div>
              <div>
                <strong>On-time payments:</strong> {detail.onTimePayments} ·{" "}
                <strong>Late payments:</strong> {detail.latePayments}
              </div>
            </div>

            <div className="tenant-detail-history">
              <h4>Recent Payment History</h4>
              <table className="tenant-history-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Due</th>
                    <th>Paid</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.paymentHistory.map((p, idx) => (
                    <tr key={idx}>
                      <td>{p.date}</td>
                      <td>${p.amountDue.toLocaleString()}</td>
                      <td>${p.amountPaid.toLocaleString()}</td>
                      <td
                        className={`status-${p.status}`}
                        style={{
                          color:
                            p.status === "on_time"
                              ? "#2ecc71"
                              : p.status === "late"
                              ? "#e67e22"
                              : "#e74c3c",
                          fontWeight: 600,
                        }}
                      >
                        {p.status === "on_time"
                          ? "On time"
                          : p.status === "late"
                          ? "Late"
                          : "Missed"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
