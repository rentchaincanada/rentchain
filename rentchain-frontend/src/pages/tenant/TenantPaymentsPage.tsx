import React, { useEffect, useState } from "react";
import {
  getTenantPayments,
  getTenantPaymentsSummary,
  getTenantRentCharges,
  confirmTenantRentCharge,
  TenantPayment,
  TenantPaymentsSummary,
  TenantRentCharge,
} from "../../api/tenantPortalApi";
import { useTenantOutletContext } from "./TenantLayout";

const cardStyle: React.CSSProperties = {
  background: "rgba(17, 24, 39, 0.8)",
  border: "1px solid rgba(255, 255, 255, 0.05)",
  borderRadius: 16,
  padding: "18px 20px",
  boxShadow: "0 12px 32px rgba(0,0,0,0.35)",
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export const TenantPaymentsPage: React.FC = () => {
  const { lease } = useTenantOutletContext();
  const [payments, setPayments] = useState<TenantPayment[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<TenantPaymentsSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [charges, setCharges] = useState<TenantRentCharge[]>([]);
  const [chargesError, setChargesError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);
      setSummaryError(null);
      setChargesError(null);
      try {
        const [history, summaryData, chargesData] = await Promise.all([
          getTenantPayments(),
          getTenantPaymentsSummary(),
          getTenantRentCharges(),
        ]);
        setPayments(history);
        setSummary(summaryData);
        setCharges(chargesData);
      } catch (err: any) {
        setError(err?.message || "Failed to load payments");
        setSummaryError(err?.message || "Failed to load payments summary");
        setChargesError(err?.message || "Failed to load rent charges");
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, []);

  const renderStatusBadge = () => {
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
          fontSize: 12,
          background: colors.bg,
          color: colors.color,
          padding: "6px 10px",
          borderRadius: 10,
          border: "1px solid rgba(59,130,246,0.15)",
          fontWeight: 700,
        }}
      >
        {colors.label}
      </span>
    );
  };

  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <div style={{ color: "#9ca3af", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Payment History
          </div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Rent payments</div>
          <div style={{ color: "#9ca3af", fontSize: 13 }}>
            {lease?.propertyName || "Your lease"} · {lease?.unitNumber ? `Unit ${lease.unitNumber}` : "Unit"}
          </div>
        </div>
        {renderStatusBadge()}
      </div>

      <div style={{ marginTop: 16, marginBottom: 12 }}>
        <div style={{ color: "#9ca3af", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Rent Charges
        </div>
        <div style={{ fontSize: 16, fontWeight: 700 }}>Landlord-issued charges</div>
        <div style={{ color: "#9ca3af", fontSize: 13, marginBottom: 6 }}>
          Rent charges are issued by your landlord and recorded for transparency.
        </div>
        {chargesError ? (
          <div style={{ color: "#fca5a5" }}>{chargesError}</div>
        ) : charges.length === 0 ? (
          <div style={{ color: "#9ca3af" }}>No rent charges issued yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
            {charges.map((c) => (
              <div
                key={c.id}
                style={{
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 12,
                  padding: "10px 12px",
                  background: "rgba(255,255,255,0.02)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#e5e7eb" }}>
                    ${c.amount?.toLocaleString()} · {c.period || "Period not set"}
                  </div>
                  <div style={{ color: "#cbd5e1", fontSize: 13 }}>
                    Due {formatDate(c.dueDate)} · Status: {c.status}
                  </div>
                </div>
                {c.status === "issued" ? (
                  <button
                    type="button"
                    onClick={async () => {
                      setConfirmingId(c.id);
                      try {
                        await confirmTenantRentCharge(c.id);
                        setCharges((prev) =>
                          prev.map((ch) =>
                            ch.id === c.id
                              ? { ...ch, status: "confirmed", confirmedAt: new Date().toISOString() }
                              : ch
                          )
                        );
                      } catch (err: any) {
                        setChargesError(err?.message || "Failed to confirm charge");
                      } finally {
                        setConfirmingId(null);
                      }
                    }}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 10,
                      border: "1px solid rgba(59,130,246,0.35)",
                      background: "rgba(59,130,246,0.1)",
                      color: "#bfdbfe",
                      fontWeight: 700,
                      cursor: confirmingId === c.id ? "wait" : "pointer",
                    }}
                    disabled={confirmingId === c.id}
                  >
                    {confirmingId === c.id ? "Confirming…" : "Confirm receipt"}
                  </button>
                ) : (
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
                    {c.status}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {error ? (
        <div style={{ color: "#fca5a5" }}>{error}</div>
      ) : isLoading ? (
        <div style={{ color: "#cbd5e1" }}>Loading payments…</div>
      ) : !lease ? (
        <div style={{ color: "#9ca3af" }}>No active lease found.</div>
      ) : payments.length === 0 ? (
        <div style={{ color: "#9ca3af" }}>No payments recorded yet.</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#94a3b8", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                <th style={{ padding: "10px 6px" }}>Date</th>
                <th style={{ padding: "10px 6px" }}>Amount</th>
                <th style={{ padding: "10px 6px" }}>Method</th>
                <th style={{ padding: "10px 6px" }}>Status</th>
                <th style={{ padding: "10px 6px" }}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                  <td style={{ padding: "10px 6px", color: "#e5e7eb", fontWeight: 600 }}>
                    {formatDate(p.paidAt || p.dueDate)}
                  </td>
                  <td style={{ padding: "10px 6px", color: "#e5e7eb" }}>
                    {p.amount ? `$${p.amount.toLocaleString()}` : "—"}
                  </td>
                  <td style={{ padding: "10px 6px", color: "#cbd5e1" }}>{p.method || "—"}</td>
                  <td style={{ padding: "10px 6px" }}>
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
                      {p.status || "Recorded"}
                    </span>
                  </td>
                  <td style={{ padding: "10px 6px", color: "#cbd5e1" }}>{p.notes || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default TenantPaymentsPage;
