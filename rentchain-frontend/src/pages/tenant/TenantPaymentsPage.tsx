import React, { useCallback, useEffect, useState } from "react";
import {
  getTenantPayments,
  getTenantPaymentsSummary,
  getTenantRentCharges,
  confirmTenantRentCharge,
  TenantPayment,
  TenantPaymentsSummary,
  TenantRentCharge,
} from "../../api/tenantPortalApi";
import { useTenantOutletContext } from "./TenantLayout.clean";
import { colors, radius, shadows, text as textTokens } from "../../styles/tokens";

const cardStyle: React.CSSProperties = {
  background: colors.card,
  border: `1px solid ${colors.border}`,
  borderRadius: radius.lg,
  padding: "18px 20px",
  boxShadow: shadows.md,
  color: textTokens.primary,
};

const stateCardStyle: React.CSSProperties = {
  border: `1px solid ${colors.border}`,
  borderRadius: radius.md,
  padding: "14px 16px",
  background: colors.panel,
  color: textTokens.primary,
};

const TenantPaymentSkeleton: React.FC = () => (
  <div role="status" aria-live="polite" aria-label="Loading payments" style={{ display: "grid", gap: 10 }}>
    {[0, 1, 2].map((index) => (
      <div
        key={index}
        style={{
          height: 14,
          width: index === 2 ? "68%" : "100%",
          borderRadius: radius.pill,
          background:
            "linear-gradient(90deg, rgba(15,23,42,0.06), rgba(37,99,235,0.12), rgba(15,23,42,0.06))",
          border: `1px solid ${colors.border}`,
        }}
      />
    ))}
  </div>
);

const TenantPaymentState: React.FC<{
  title: string;
  body: string;
  tone?: "neutral" | "error";
  action?: React.ReactNode;
}> = ({ title, body, tone = "neutral", action }) => (
  <div
    role={tone === "error" ? "alert" : undefined}
    style={{
      ...stateCardStyle,
      borderColor: tone === "error" ? "rgba(239,68,68,0.22)" : colors.border,
      background: tone === "error" ? "rgba(254,242,242,0.95)" : stateCardStyle.background,
      display: "grid",
      gap: 8,
    }}
  >
    <div style={{ fontWeight: 800 }}>{title}</div>
    <div style={{ color: tone === "error" ? "#7f1d1d" : textTokens.muted, lineHeight: 1.5 }}>{body}</div>
    {action ? <div>{action}</div> : null}
  </div>
);

function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function optionalSurfaceError(reason: any, fallback: string): string | null {
  return reason?.status === 404 ? null : reason?.message || fallback;
}

export const TenantPaymentsPage: React.FC = () => {
  const tenantContext = useTenantOutletContext();
  const lease = tenantContext?.lease ?? null;
  const [payments, setPayments] = useState<TenantPayment[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<TenantPaymentsSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [charges, setCharges] = useState<TenantRentCharge[]>([]);
  const [chargesError, setChargesError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadPayments = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setSummaryError(null);
    setChargesError(null);
    try {
      const [historyResult, summaryResult, chargesResult] = await Promise.allSettled([
        getTenantPayments(),
        getTenantPaymentsSummary(),
        getTenantRentCharges(),
      ]);
      if (historyResult.status === "fulfilled") {
        setPayments(Array.isArray(historyResult.value) ? historyResult.value : []);
      } else {
        setError(historyResult.reason?.message || "Failed to load payments");
        setPayments([]);
      }
      if (summaryResult.status === "fulfilled") {
        setSummary(summaryResult.value);
      } else {
        setSummary(null);
        setSummaryError(optionalSurfaceError(summaryResult.reason, "Payment summary is unavailable"));
      }
      if (chargesResult.status === "fulfilled") {
        setCharges(Array.isArray(chargesResult.value) ? chargesResult.value : []);
      } else {
        setCharges([]);
        setChargesError(optionalSurfaceError(chargesResult.reason, "Rent charges are unavailable"));
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load payments");
      setSummaryError(err?.message || "Failed to load payments summary");
      setChargesError(err?.message || "Failed to load rent charges");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPayments();
  }, [loadPayments, refreshKey]);

  const renderStatusBadge = () => {
    const status = summary?.currentPeriod?.status ?? "unknown";
    const palette: Record<string, { bg: string; color: string; label: string }> = {
      on_time: { bg: "#dcfce7", color: "#166534", label: "On track" },
      late: { bg: "#fee2e2", color: "#991b1b", label: "Late" },
      partial: { bg: "#fef3c7", color: "#92400e", label: "Partial" },
      unpaid: { bg: "#f1f5f9", color: "#334155", label: "Unpaid" },
      unknown: { bg: "#f1f5f9", color: "#334155", label: "Unknown" },
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
          border: `1px solid ${colors.border}`,
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
          <div style={{ color: textTokens.subtle, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Payment History
          </div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Rent payments</div>
          <div style={{ color: textTokens.muted, fontSize: 13 }}>
            {lease?.propertyName || "Your lease"} · {lease?.unitNumber ? `Unit ${lease.unitNumber}` : "Unit"}
          </div>
        </div>
        {renderStatusBadge()}
      </div>

      <div style={{ marginTop: 16, marginBottom: 12 }}>
        <div style={{ color: textTokens.subtle, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Rent Charges
        </div>
        <div style={{ fontSize: 16, fontWeight: 700 }}>Landlord-issued charges</div>
        <div style={{ color: textTokens.muted, fontSize: 13, marginBottom: 6 }}>
          Rent charges are issued by your landlord and recorded for transparency.
        </div>
        {chargesError ? (
          <div style={{ color: colors.danger }}>{chargesError}</div>
        ) : charges.length === 0 ? (
          <div style={{ color: textTokens.muted }}>No rent charges issued yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
            {charges.map((c) => (
              <div
                key={c.id}
                style={{
                  border: `1px solid ${colors.border}`,
                  borderRadius: radius.md,
                  padding: "10px 12px",
                  background: colors.panel,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: textTokens.primary }}>
                    ${c.amount?.toLocaleString()} · {c.period || "Period not set"}
                  </div>
                  <div style={{ color: textTokens.muted, fontSize: 13 }}>
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
                      borderRadius: radius.md,
                      border: `1px solid ${colors.borderStrong}`,
                      background: colors.accentSoft,
                      color: colors.accent,
                      fontWeight: 700,
                      cursor: confirmingId === c.id ? "wait" : "pointer",
                    }}
                    disabled={confirmingId === c.id}
                  >
                    {confirmingId === c.id ? "Confirming..." : "Confirm receipt"}
                  </button>
                ) : (
                  <span
                    style={{
                      background: colors.accentSoft,
                      color: colors.accent,
                      padding: "6px 10px",
                      borderRadius: radius.md,
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
        <TenantPaymentState
          title="Payments unavailable"
          body={error}
          tone="error"
          action={
            <button
              type="button"
              onClick={() => setRefreshKey((value) => value + 1)}
              style={{
                padding: "8px 12px",
                borderRadius: radius.md,
                border: "1px solid rgba(239,68,68,0.28)",
                background: "#fff",
                color: "#991b1b",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
          }
        />
      ) : isLoading ? (
        <TenantPaymentSkeleton />
      ) : !lease ? (
        <TenantPaymentState
          title="No active lease found"
          body="Payment history appears after an active lease is linked to your tenant workspace."
        />
      ) : payments.length === 0 ? (
        <TenantPaymentState title="No payments yet" body="Recorded rent payments will appear here with date, amount, method, status, and notes." />
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
            <thead>
              <tr style={{ textAlign: "left", color: textTokens.subtle, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                <th style={{ padding: "10px 6px" }}>Date</th>
                <th style={{ padding: "10px 6px" }}>Amount</th>
                <th style={{ padding: "10px 6px" }}>Method</th>
                <th style={{ padding: "10px 6px" }}>Status</th>
                <th style={{ padding: "10px 6px" }}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} style={{ borderTop: `1px solid ${colors.border}` }}>
                  <td style={{ padding: "10px 6px", color: textTokens.primary, fontWeight: 600 }}>
                    {formatDate(p.paidAt || p.dueDate)}
                  </td>
                  <td style={{ padding: "10px 6px", color: textTokens.primary }}>
                    {p.amount ? `$${p.amount.toLocaleString()}` : "—"}
                  </td>
                  <td style={{ padding: "10px 6px", color: textTokens.muted }}>{p.method || "—"}</td>
                  <td style={{ padding: "10px 6px" }}>
                    <span
                      style={{
                        background: colors.accentSoft,
                        color: colors.accent,
                        padding: "6px 10px",
                        borderRadius: radius.md,
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {p.status || "Recorded"}
                    </span>
                  </td>
                  <td style={{ padding: "10px 6px", color: textTokens.muted }}>{p.notes || "—"}</td>
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
