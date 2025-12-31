import React, { useEffect, useMemo, useState } from "react";
import { Lease, getLeasesForTenant } from "../../api/leasesApi";
import { Payment, getTenantMonthlyPayments } from "../../api/paymentsApi";
import { safeNumber } from "@/utils/format";

interface TenantPaymentsPanelProps {
  tenantId: string | null;
}

export const TenantPaymentsPanel: React.FC<TenantPaymentsPanelProps> = ({
  tenantId,
}) => {
  const [leases, setLeases] = useState<Lease[]>([]);
  const [activeLease, setActiveLease] = useState<Lease | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [totalThisMonth, setTotalThisMonth] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!tenantId) {
      setLeases([]);
      setActiveLease(null);
      setPayments([]);
      setTotalThisMonth(0);
      setIsLoading(false);
      setError(null);
      return () => {
        cancelled = true;
      };
    }

    const load = async () => {
      try {
        setIsLoading(true);
        const leaseResp = await getLeasesForTenant(tenantId);
        if (cancelled) return;
        setLeases(leaseResp.leases);
        const active = leaseResp.leases.find((l) => l.status === "active") ?? null;
        setActiveLease(active);

        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;

        const paymentsResp = await getTenantMonthlyPayments(tenantId, year, month);
        if (cancelled) return;
        setPayments(paymentsResp.payments);
        setTotalThisMonth(paymentsResp.total);
        setError(null);
      } catch (err) {
        const status = (err as any)?.status ?? (err as any)?.payload?.status;
        if (status === 404) {
          if (!cancelled) {
            setPayments([]);
            setTotalThisMonth(0);
            setError(null);
          }
          return;
        }
        console.error("[TenantPaymentsPanel] Failed to load payments", err);
        if (!cancelled) {
          setPayments([]);
          setTotalThisMonth(0);
          setError("Failed to load payments");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  const lastPayment = useMemo(() => {
    if (!payments || payments.length === 0) return null;
    return payments
      .slice()
      .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime())[0];
  }, [payments]);

  const monthlyRent = activeLease?.monthlyRent ?? null;
  const delta = monthlyRent != null ? totalThisMonth - monthlyRent : null;

  const formatMoney = (value: number | null) => {
    if (value == null) return "—";
    return `$${safeNumber(value, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`;
  };

  const formatDate = (value?: string) => {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString();
  };

  const renderStatus = () => {
    if (monthlyRent == null) {
      return "Status: No rent configured";
    }
    if (delta === null) return "Status: Unknown";
    if (delta >= 0) {
      return delta === 0
        ? "Status: Current"
        : `Status: Current / Overpaid (+${formatMoney(delta)})`;
    }
    return `Status: Behind (${formatMoney(Math.abs(delta))} owing)`;
  };

  let content: React.ReactNode = null;

  if (!tenantId) {
    content = (
      <div style={{ color: "#9ca3af", fontSize: "0.9rem" }}>
        Select a tenant to view payment information.
      </div>
    );
  } else if (isLoading) {
    content = (
      <div style={{ color: "#9ca3af", fontSize: "0.9rem" }}>
        Loading payments…
      </div>
    );
  } else if (error) {
    content = (
      <div style={{ color: "#f97316", fontSize: "0.9rem" }}>{error}</div>
    );
  } else if (!activeLease) {
    content = (
      <div style={{ color: "#9ca3af", fontSize: "0.9rem" }}>
        No active lease for this tenant. Payments can’t be compared to rent yet.
      </div>
    );
  } else {
    content = (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 10,
          }}
        >
          <div
            style={{
              borderRadius: 12,
              border: "1px solid rgba(148,163,184,0.2)",
              padding: 10,
              background: "rgba(255,255,255,0.02)",
            }}
          >
            <div style={{ color: "#94a3b8", fontSize: 12 }}>Monthly Rent</div>
            <div style={{ color: "#e5e7eb", fontWeight: 700, fontSize: 16 }}>
              {formatMoney(monthlyRent)}
            </div>
          </div>

          <div
            style={{
              borderRadius: 12,
              border: "1px solid rgba(148,163,184,0.2)",
              padding: 10,
              background: "rgba(255,255,255,0.02)",
            }}
          >
            <div style={{ color: "#94a3b8", fontSize: 12 }}>Paid This Month</div>
            <div style={{ color: "#e5e7eb", fontWeight: 700, fontSize: 16 }}>
              {formatMoney(totalThisMonth)}
            </div>
          </div>

          <div
            style={{
              borderRadius: 12,
              border: "1px solid rgba(148,163,184,0.2)",
              padding: 10,
              background: "rgba(255,255,255,0.02)",
            }}
          >
            <div style={{ color: "#94a3b8", fontSize: 12 }}>Status</div>
            <div style={{ color: "#e5e7eb", fontWeight: 700, fontSize: 16 }}>
              {renderStatus()}
            </div>
          </div>
        </div>

        <div
          style={{
            borderRadius: 12,
            border: "1px solid rgba(148,163,184,0.2)",
            padding: 10,
            background: "rgba(255,255,255,0.02)",
          }}
        >
          <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 6 }}>
            Last Payment
          </div>
          <div style={{ color: "#e5e7eb", fontSize: 14 }}>
            {lastPayment
              ? `${formatMoney(lastPayment.amount)} on ${formatDate(
                  lastPayment.paidAt
                )} via ${lastPayment.method}`
              : "No payments recorded yet."}
          </div>
        </div>

        {payments.length > 0 && (
          <div
            style={{
              borderRadius: 12,
              border: "1px solid rgba(148,163,184,0.2)",
              padding: 10,
              background: "rgba(255,255,255,0.01)",
            }}
          >
            <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 6 }}>
              Payments this month
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {payments.map((p) => (
                <div
                  key={p.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderRadius: 10,
                    border: "1px solid rgba(148,163,184,0.15)",
                    padding: "8px 10px",
                    color: "#e5e7eb",
                    fontSize: 13,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>{formatMoney(p.amount)}</div>
                    <div style={{ color: "#9ca3af", fontSize: 12 }}>
                      {formatDate(p.paidAt)} · {p.method}
                    </div>
                  </div>
                  {p.notes && (
                    <div style={{ color: "#9ca3af", fontSize: 12 }}>{p.notes}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontWeight: 600, color: "#e5e7eb", fontSize: "1rem" }}>
        Payments / Rent Status
      </div>
      {content}
    </div>
  );
};

