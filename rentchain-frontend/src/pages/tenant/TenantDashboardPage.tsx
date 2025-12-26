import React, { useEffect, useMemo, useState } from "react";
import { useTenantOutletContext } from "./TenantLayout.clean";
import {
  getTenantPaymentsSummary,
  getTenantRentCharges,
  TenantPaymentsSummary,
  TenantRentCharge,
  confirmTenantRentCharge,
} from "../../api/tenantPortalApi";

function formatDate(date?: string | null) {
  if (!date) return "—";
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function computeNextRentDue(leaseStart?: string | null) {
  if (!leaseStart) return "—";
  const start = new Date(leaseStart);
  if (Number.isNaN(start.getTime())) return "—";
  const today = new Date();
  const dueDay = start.getDate();
  const next = new Date(today.getFullYear(), today.getMonth(), dueDay);
  if (next < today) {
    next.setMonth(next.getMonth() + 1);
  }
  return next.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

const cardStyle: React.CSSProperties = {
  background: "rgba(17, 24, 39, 0.8)",
  border: "1px solid rgba(255, 255, 255, 0.05)",
  borderRadius: 16,
  padding: "18px 20px",
  boxShadow: "0 12px 32px rgba(0,0,0,0.35)",
};

const labelStyle: React.CSSProperties = { color: "#9ca3af", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em" };

export const TenantDashboardPage: React.FC = () => {
  const { lease, profile } = useTenantOutletContext();
  const [summary, setSummary] = useState<TenantPaymentsSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [charges, setCharges] = useState<TenantRentCharge[]>([]);
  const [chargesError, setChargesError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getTenantPaymentsSummary();
        setSummary(data);
      } catch (err: any) {
        setSummaryError(err?.message || "Failed to load payment summary");
      }
    };
    void load();
  }, []);

  useEffect(() => {
    const loadCharges = async () => {
      try {
        const data = await getTenantRentCharges();
        setCharges(data);
      } catch (err: any) {
        setChargesError(err?.message || "Failed to load rent charges");
      }
    };
    void loadCharges();
  }, []);

  const statusBadge = useMemo(() => {
    const status = lease?.status ?? "active";
    const palette: Record<string, { bg: string; color: string }> = {
      active: { bg: "rgba(34,197,94,0.14)", color: "#bbf7d0" },
      ended: { bg: "rgba(148,163,184,0.2)", color: "#e2e8f0" },
      pending: { bg: "rgba(59,130,246,0.14)", color: "#bfdbfe" },
    };
    const key = status.toLowerCase();
    const colors = palette[key] || palette.active;
    return (
      <span
        style={{
          background: colors.bg,
          color: colors.color,
          padding: "6px 10px",
          borderRadius: 12,
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        {status}
      </span>
    );
  }, [lease?.status]);

  const paymentStatusBadge = useMemo(() => {
    const status = summary?.currentPeriod?.status ?? "unknown";
    const palette: Record<string, { bg: string; color: string; label: string }> = {
      on_time: { bg: "rgba(34,197,94,0.14)", color: "#bbf7d0", label: "On track" },
      late: { bg: "rgba(248,113,113,0.16)", color: "#fecaca", label: "Late" },
      partial: { bg: "rgba(234,179,8,0.16)", color: "#fef08a", label: "Partial" },
      unpaid: { bg: "rgba(148,163,184,0.2)", color: "#e2e8f0", label: "Unpaid" },
      unknown: { bg: "rgba(148,163,184,0.16)", color: "#cbd5e1", label: "Unknown" },
    };
    const colors = palette[status] || palette.unknown;
    return (
      <span
        style={{
          background: colors.bg,
          color: colors.color,
          padding: "6px 10px",
          borderRadius: 12,
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        {colors.label}
      </span>
    );
  }, [summary?.currentPeriod?.status]);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div>
            <div style={labelStyle}>Lease</div>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em" }}>
              {lease?.propertyName || "Your Lease"}
            </div>
            <div style={{ color: "#cbd5e1", fontSize: 14 }}>
              {lease?.unitNumber ? `Unit ${lease.unitNumber}` : ""} {lease?.propertyId ? ` · ID ${lease.propertyId}` : ""}
            </div>
          </div>
          {statusBadge}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <div>
            <div style={labelStyle}>Rent Amount</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>
              {lease?.rentAmount ? `$${lease.rentAmount.toLocaleString()}` : "—"}
            </div>
          </div>
          <div>
            <div style={labelStyle}>Lease Term</div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>
              {formatDate(lease?.leaseStart)} — {formatDate(lease?.leaseEnd)}
            </div>
          </div>
          <div>
            <div style={labelStyle}>Next Rent Due</div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{computeNextRentDue(lease?.leaseStart)}</div>
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ marginBottom: 10 }}>
          <div style={labelStyle}>Tenant</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{profile?.fullName || "Your account"}</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          <div>
            <div style={labelStyle}>Email</div>
            <div style={{ fontSize: 14, color: "#e5e7eb" }}>{profile?.email || "—"}</div>
          </div>
          <div>
            <div style={labelStyle}>Phone</div>
            <div style={{ fontSize: 14, color: "#e5e7eb" }}>{profile?.phone || "—"}</div>
          </div>
          <div>
            <div style={labelStyle}>Status</div>
            <div style={{ fontSize: 14, color: "#e5e7eb" }}>{profile?.status || "—"}</div>
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div>
            <div style={labelStyle}>Rent Status</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Payments readiness</div>
            <div style={{ color: "#9ca3af", fontSize: 13 }}>
              Payments are shown for transparency. Rent submission is not enabled in this portal.
            </div>
          </div>
          {paymentStatusBadge}
        </div>
        {summaryError ? (
          <div style={{ color: "#fca5a5" }}>{summaryError}</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <div>
              <div style={labelStyle}>Next Rent Due</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{formatDate(summary?.nextDueDate)}</div>
            </div>
            <div>
              <div style={labelStyle}>Rent Amount</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>
                {summary?.rentAmount ? `$${summary.rentAmount.toLocaleString()}` : "—"}
              </div>
            </div>
            <div>
              <div style={labelStyle}>Last Payment</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>
                {summary?.lastPayment
                  ? `${summary.lastPayment.amount ? `$${summary.lastPayment.amount.toLocaleString()}` : ""} ${
                      summary.lastPayment.paidAt ? `on ${formatDate(summary.lastPayment.paidAt)}` : ""
                    }`
                  : "—"}
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div>
            <div style={labelStyle}>Latest Rent Charge</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Landlord-issued charge</div>
            <div style={{ color: "#9ca3af", fontSize: 13 }}>
              Rent charges are issued by your landlord and recorded for transparency.
            </div>
          </div>
          {charges[0]?.status ? (
            <span
              style={{
                background: "rgba(59,130,246,0.12)",
                color: "#bfdbfe",
                padding: "6px 10px",
                borderRadius: 12,
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {charges[0].status}
            </span>
          ) : null}
        </div>
        {chargesError ? (
          <div style={{ color: "#fca5a5" }}>{chargesError}</div>
        ) : charges.length === 0 ? (
          <div style={{ color: "#9ca3af" }}>No rent charges have been issued yet.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <div>
              <div style={labelStyle}>Amount</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>
                {charges[0].amount ? `$${charges[0].amount.toLocaleString()}` : "—"}
              </div>
            </div>
            <div>
              <div style={labelStyle}>Due date</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{formatDate(charges[0].dueDate)}</div>
            </div>
            <div>
              <div style={labelStyle}>Period</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{charges[0].period || "—"}</div>
            </div>
            <div>
              <div style={labelStyle}>Status</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{charges[0].status}</div>
            </div>
          </div>
        )}
        {charges[0]?.status === "issued" && (
          <div style={{ marginTop: 12 }}>
            <button
              type="button"
              onClick={async () => {
                if (!charges[0]) return;
                setConfirming(charges[0].id);
                try {
                  await confirmTenantRentCharge(charges[0].id);
                  setCharges((prev) =>
                    prev.map((c) => (c.id === charges[0].id ? { ...c, status: "confirmed", confirmedAt: new Date().toISOString() } : c))
                  );
                } catch (err: any) {
                  setChargesError(err?.message || "Failed to confirm charge");
                } finally {
                  setConfirming(null);
                }
              }}
              style={{
                padding: "8px 14px",
                borderRadius: 10,
                border: "1px solid rgba(59,130,246,0.3)",
                background: "rgba(59,130,246,0.08)",
                color: "#bfdbfe",
                fontWeight: 700,
                cursor: confirming ? "wait" : "pointer",
              }}
              disabled={!!confirming}
            >
              {confirming ? "Confirming…" : "Confirm receipt"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TenantDashboardPage;
