// src/components/tenants/TenantDetails.tsx
import React from "react";

export type PaymentStatus = "on-time" | "late" | "partial" | "missed";

export interface TenantPaymentHistoryItem {
  id: string;
  date: string;
  amount: number;
  status: PaymentStatus;
  note?: string;
}

export interface TenantDetailsModel {
  id: string;
  name: string;
  propertyName?: string;
  unit?: string;
  monthlyRent?: number;
  email?: string;
  phone?: string;
  leaseStart?: string;
  leaseEnd?: string;
  status?: string;
  currentBalance?: number;
  riskLevel?: "Low" | "Medium" | "High" | string;
  notes?: string;
  paymentHistory?: TenantPaymentHistoryItem[];
}

interface TenantDetailsProps {
  tenant: TenantDetailsModel | null;
}

const formatCurrency = (value?: number) =>
  typeof value === "number" ? `$${value.toFixed(2)}` : "—";

const formatDate = (iso?: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString();
};

const statusLabel: Record<PaymentStatus, string> = {
  "on-time": "On-time",
  late: "Late",
  partial: "Partial",
  missed: "Missed",
};

export const TenantDetails: React.FC<TenantDetailsProps> = ({ tenant }) => {
  if (!tenant) {
    return <div>Select a tenant from the list to view details.</div>;
  }

  const history = tenant.paymentHistory ?? [];

  return (
    <div className="tenant-details">
      <div className="tenant-details-header">
        <div>
          <h2>{tenant.name}</h2>
          <div className="tenant-details-subtitle">
            {tenant.propertyName && <span>{tenant.propertyName}</span>}
            {tenant.unit && <span> · Unit {tenant.unit}</span>}
            {tenant.status && <span> · {tenant.status}</span>}
          </div>
        </div>
        {tenant.riskLevel && (
          <span className={`badge risk-${tenant.riskLevel.toLowerCase()}`}>
            {tenant.riskLevel} risk
          </span>
        )}
      </div>

      <div className="tenant-details-grid">
        <div className="tenant-details-section">
          <h3>Contact</h3>
          <dl className="details-list">
            <div>
              <dt>Email</dt>
              <dd>{tenant.email ?? "—"}</dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>{tenant.phone ?? "—"}</dd>
            </div>
          </dl>
        </div>

        <div className="tenant-details-section">
          <h3>Lease & Rent</h3>
          <dl className="details-list">
            <div>
              <dt>Monthly rent</dt>
              <dd>{formatCurrency(tenant.monthlyRent)}</dd>
            </div>
            <div>
              <dt>Current balance</dt>
              <dd
                className={
                  tenant.currentBalance && tenant.currentBalance > 0
                    ? "text-negative"
                    : tenant.currentBalance && tenant.currentBalance < 0
                    ? "text-positive"
                    : ""
                }
              >
                {formatCurrency(tenant.currentBalance)}
              </dd>
            </div>
            <div>
              <dt>Lease</dt>
              <dd>
                {tenant.leaseStart || tenant.leaseEnd
                  ? `${formatDate(tenant.leaseStart)} → ${formatDate(
                      tenant.leaseEnd
                    )}`
                  : "—"}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {history.length > 0 && (
        <div className="tenant-details-section">
          <h3>Payment history (last {history.length} payments)</h3>
          <table className="table compact payment-history-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {history.map((p) => (
                <tr key={p.id}>
                  <td>{formatDate(p.date)}</td>
                  <td>{formatCurrency(p.amount)}</td>
                  <td>
                    <span
                      className={`badge payment-${p.status.replace(" ", "-")}`}
                    >
                      {statusLabel[p.status]}
                    </span>
                  </td>
                  <td>{p.note ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tenant.notes && (
        <div className="tenant-details-section">
          <h3>Notes</h3>
          <p className="tenant-notes">{tenant.notes}</p>
        </div>
      )}
    </div>
  );
};
