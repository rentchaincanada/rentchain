// @ts-nocheck
// src/components/tenants/TenantBalanceSummary.tsx
import React, { useEffect, useState } from "react";
import {
  fetchTenantBalance,
  TenantBalanceSummary as BalanceSummary,
} from "../../services/tenantBalanceApi";

interface TenantBalanceSummaryProps {
  tenantId: string | null;
}

/**
 * TenantBalanceSummary
 *
 * STEP B: Already gave us the polished UI.
 * STEP A (now): wire it to the real backend /tenant-balance/:tenantId.
 */
export const TenantBalanceSummary: React.FC<TenantBalanceSummaryProps> = ({
  tenantId,
}) => {
  const [summary, setSummary] = useState<BalanceSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!tenantId) {
        setSummary(null);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const data = await fetchTenantBalance(tenantId);
        if (!cancelled) {
          setSummary(data);
        }
      } catch (err) {
        console.error("Failed to load tenant balance", err);
        if (!cancelled) {
          setError("Failed to load tenant balance.");
          setSummary(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  // If no tenant is selected
  if (!tenantId) {
    return (
      <div
        style={{
          borderRadius: "1.5rem",
          border: "1px dashed rgba(148,163,184,0.5)",
          background: "rgba(15,23,42,0.9)",
          padding: "1rem 1.25rem",
          color: "#9ca3af",
          fontSize: "0.85rem",
        }}
      >
        Select a tenant on the left to view their account balance summary.
      </div>
    );
  }

  const balance = summary?.currentBalance ?? 0;
  const isInArrears = balance > 0;
  const isInCredit = balance < 0;

  const balanceLabel = isInArrears
    ? "Amount owing"
    : isInCredit
    ? "Credit on account"
    : "Account is fully paid";

  const balanceDisplay = Math.abs(balance).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  // Simple health tag
  const healthText = isInArrears
    ? balance > 1000
      ? "High balance owing"
      : "Minor balance owing"
    : isInCredit
    ? "In good standing (credit)"
    : "Up to date";

  const healthColor = isInArrears
    ? balance > 1000
      ? "#f97316" // orange
      : "#facc15" // amber
    : "#22c55e"; // green

  const nextChargeLabel =
    summary?.nextChargeAmount && summary?.nextChargeDate
      ? {
          amount: summary.nextChargeAmount,
          date: summary.nextChargeDate,
        }
      : null;

  const lastPaymentLabel =
    summary?.lastPaymentAmount && summary?.lastPaymentDate
      ? {
          amount: summary.lastPaymentAmount,
          date: summary.lastPaymentDate,
        }
      : null;

  return (
    <div
      style={{
        borderRadius: "1.5rem",
        border: "1px solid rgba(148,163,184,0.4)",
        background:
          "radial-gradient(circle at top left, rgba(59,130,246,0.18), transparent 55%), radial-gradient(circle at bottom right, rgba(15,23,42,0.95), #020617)",
        padding: "1rem 1.25rem",
        color: "#e5e7eb",
        boxShadow: "0 18px 40px rgba(15,23,42,0.8)",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
        
      }}
    >  <TenantLeasePanel tenantId={tenant?.id ?? null} />
      {/* Header row */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: "0.75rem",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "0.7rem",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "#9ca3af",
              marginBottom: "0.15rem",
            }}
          >
            Tenant Account
          </div>
          <div
            style={{
              fontSize: "1rem",
              fontWeight: 600,
            }}
          >
            Balance summary
          </div>
        </div>

        <div
          style={{
            fontSize: "0.75rem",
            color: "#9ca3af",
            textAlign: "right",
          }}
        >
          Tenant: {tenantId}
          {summary && (
            <div
              style={{
                fontSize: "0.7rem",
                color: "#6b7280",
              }}
            >
              {summary.eventCount} ledger events
            </div>
          )}
        </div>
      </div>

      {/* Error / loading state */}
      {error && (
        <div
          style={{
            padding: "0.5rem 0.75rem",
            borderRadius: "0.75rem",
            background: "rgba(248,113,113,0.08)",
            border: "1px solid rgba(248,113,113,0.35)",
            color: "#fecaca",
            fontSize: "0.8rem",
          }}
        >
          {error}
        </div>
      )}

      {/* Main balance row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          opacity: loading ? 0.7 : 1,
        }}
      >
        <div>
          <div
            style={{
              fontSize: "0.8rem",
              color: "#9ca3af",
              marginBottom: "0.1rem",
            }}
          >
            {balanceLabel}
          </div>
          <div
            style={{
              fontSize: "1.6rem",
              fontWeight: 700,
              letterSpacing: "-0.03em",
            }}
          >
            {isInCredit && "-"}${balanceDisplay}
          </div>
        </div>

        {/* Health pill */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 4,
          }}
        >
          <div
            style={{
              padding: "4px 10px",
              borderRadius: 999,
              border: `1px solid ${healthColor}`,
              color: healthColor,
              fontSize: "0.7rem",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: 0.7,
              background: "rgba(15,23,42,0.95)",
            }}
          >
            {loading ? "Updating…" : healthText}
          </div>
          <div
            style={{
              fontSize: "0.7rem",
              color: "#9ca3af",
            }}
          >
            As of today
          </div>
        </div>
      </div>

      {/* Metrics row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: "0.75rem",
          marginTop: "0.25rem",
        }}
      >
        {/* Next charge */}
        <div
          style={{
            padding: "0.6rem 0.7rem",
            borderRadius: "0.9rem",
            border: "1px solid rgba(59,130,246,0.3)",
            background: "rgba(15,23,42,0.85)",
          }}
        >
          <div
            style={{
              fontSize: "0.7rem",
              color: "#9ca3af",
              marginBottom: "0.15rem",
            }}
          >
            Next rent charge
          </div>
          <div
            style={{
              fontSize: "0.9rem",
              fontWeight: 600,
            }}
          >
            {nextChargeLabel
              ? `$${nextChargeLabel.amount.toLocaleString()}`
              : "—"}
          </div>
          <div
            style={{
              fontSize: "0.7rem",
              color: "#9ca3af",
              marginTop: "0.1rem",
            }}
          >
            {nextChargeLabel ? `On ${nextChargeLabel.date}` : "No charge scheduled"}
          </div>
        </div>

        {/* Year-to-date */}
        <div
          style={{
            padding: "0.6rem 0.7rem",
            borderRadius: "0.9rem",
            border: "1px solid rgba(56,189,248,0.25)",
            background: "rgba(15,23,42,0.85)",
          }}
        >
          <div
            style={{
              fontSize: "0.7rem",
              color: "#9ca3af",
              marginBottom: "0.15rem",
            }}
          >
            Year-to-date
          </div>
          <div
            style={{
              fontSize: "0.8rem",
            }}
          >
            Charges:{" "}
            <span
              style={{
                fontWeight: 600,
              }}
            >
              $
              {(summary?.totalCharges ?? 0).toLocaleString(undefined, {
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
          <div
            style={{
              fontSize: "0.8rem",
            }}
          >
            Payments:{" "}
            <span
              style={{
                fontWeight: 600,
              }}
            >
              $
              {(summary?.totalPayments ?? 0).toLocaleString(undefined, {
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
        </div>

        {/* Last payment */}
        <div
          style={{
            padding: "0.6rem 0.7rem",
            borderRadius: "0.9rem",
            border: "1px solid rgba(34,197,94,0.35)",
            background: "rgba(15,23,42,0.9)",
          }}
        >
          <div
            style={{
              fontSize: "0.7rem",
              color: "#9ca3af",
              marginBottom: "0.15rem",
            }}
          >
            Last payment
          </div>
          <div
            style={{
              fontSize: "0.9rem",
              fontWeight: 600,
            }}
          >
            {lastPaymentLabel
              ? `$${lastPaymentLabel.amount.toLocaleString()}`
              : "—"}
          </div>
          <div
            style={{
              fontSize: "0.7rem",
              color: "#9ca3af",
              marginTop: "0.1rem",
            }}
          >
            {lastPaymentLabel ? `On ${lastPaymentLabel.date}` : "No payments yet"}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TenantBalanceSummary;
