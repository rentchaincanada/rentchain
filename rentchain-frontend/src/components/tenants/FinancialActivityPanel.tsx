import React from "react";
import { colors, radius, spacing, text } from "../../styles/tokens";
import type { FinancialProjectionRow, FinancialProjectionSourceType } from "@/api/tenantDetail";

type FinancialActivityPanelProps = {
  rows: FinancialProjectionRow[];
  loading: boolean;
  error: string | null;
};

type FinancialActivityGroupKey = FinancialProjectionSourceType;

const groupOrder: FinancialActivityGroupKey[] = [
  "recorded_payment",
  "lease_charge",
  "lease_credit",
  "ledger_payment_unmatched",
];

const groupLabels: Record<FinancialActivityGroupKey, string> = {
  recorded_payment: "Recorded Payments",
  lease_charge: "Lease Charges",
  lease_credit: "Lease Credits",
  ledger_payment_unmatched: "Unmatched Ledger Payments",
};

const badgeLabels: Record<FinancialActivityGroupKey, string> = {
  recorded_payment: "Payment",
  lease_charge: "Lease Charge",
  lease_credit: "Credit",
  ledger_payment_unmatched: "Unmatched Ledger Entry",
};

function toMillis(value: string): number {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDateLabel(value: string) {
  const parsed = new Date(String(value || ""));
  if (Number.isNaN(parsed.getTime())) return "Unknown date";
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatMoney(value: number, direction: "credit" | "debit") {
  const magnitude = Math.abs(Number(value || 0));
  const prefix = direction === "debit" ? "-" : "+";
  return `${prefix}$${magnitude.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function buildContextLabel(row: FinancialProjectionRow) {
  const parts = [row.propertyLabel, row.unitLabel ? `Unit ${row.unitLabel}` : null].filter(Boolean);
  return parts.length ? parts.join(" • ") : null;
}

export const FinancialActivityPanel: React.FC<FinancialActivityPanelProps> = ({
  rows,
  loading,
  error,
}) => {
  const sortedRows = React.useMemo(
    () =>
      [...rows].sort((left, right) => {
        const timeDiff = toMillis(right.occurredAt) - toMillis(left.occurredAt);
        if (timeDiff !== 0) return timeDiff;
        const typeDiff = groupOrder.indexOf(left.sourceType) - groupOrder.indexOf(right.sourceType);
        if (typeDiff !== 0) return typeDiff;
        return String(left.sourceId || left.id).localeCompare(String(right.sourceId || right.id));
      }),
    [rows]
  );

  const groupedRows = React.useMemo(() => {
    const next = new Map<FinancialActivityGroupKey, FinancialProjectionRow[]>();
    groupOrder.forEach((key) => next.set(key, []));
    sortedRows.forEach((row) => {
      next.get(row.sourceType)?.push(row);
    });
    return next;
  }, [sortedRows]);

  return (
    <div
      style={{
        padding: spacing.md,
        borderRadius: radius.md,
        border: "1px solid rgba(91,70,48,0.16)",
        background: "#fff6e8",
        boxShadow: "0 10px 24px rgba(59,44,28,0.08)",
        display: "grid",
        gap: spacing.md,
      }}
    >
      <div style={{ display: "grid", gap: 4 }}>
        <div style={{ fontWeight: 700 }}>Financial activity</div>
        <div style={{ color: text.muted, fontSize: "0.8rem" }}>
          Read-only activity across recorded payments and current lease ledger items. Underlying records remain
          separate.
        </div>
      </div>

      {loading ? <div style={{ color: text.muted }}>Loading financial activity...</div> : null}
      {!loading && error ? <div style={{ color: colors.danger, fontSize: "0.85rem" }}>Could not load financial activity.</div> : null}
      {!loading && !error && sortedRows.length === 0 ? (
        <div style={{ color: text.muted }}>No financial activity is available for this tenant yet.</div>
      ) : null}

      {!loading && !error && sortedRows.length > 0 ? (
        <div style={{ display: "grid", gap: spacing.md }}>
          {groupOrder.map((groupKey) => {
            const items = groupedRows.get(groupKey) || [];
            if (items.length === 0) return null;
            return (
              <section key={groupKey} style={{ display: "grid", gap: 8 }}>
                <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{groupLabels[groupKey]}</div>
                <div style={{ display: "grid", gap: 8 }}>
                  {items.map((row) => {
                    const contextLabel = buildContextLabel(row);
                    return (
                      <div
                        key={row.id}
                        style={{
                          border: "1px solid rgba(91,70,48,0.16)",
                          borderRadius: 10,
                          padding: 12,
                          background: "#fffaf1",
                          display: "grid",
                          gap: 6,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
                          <div style={{ display: "grid", gap: 4 }}>
                            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                              <div style={{ fontWeight: 700, fontSize: "0.88rem" }}>{row.displayLabel}</div>
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  padding: "2px 8px",
                                  borderRadius: radius.pill,
                                  border: "1px solid rgba(91,70,48,0.16)",
                                  background: "#fff6e8",
                                  color: text.primary,
                                  fontSize: "0.72rem",
                                  fontWeight: 700,
                                }}
                              >
                                {badgeLabels[groupKey]}
                              </span>
                            </div>
                            {contextLabel ? <div style={{ color: text.muted, fontSize: "0.8rem" }}>{contextLabel}</div> : null}
                          </div>
                          <div style={{ display: "grid", gap: 4, justifyItems: "end", textAlign: "right" }}>
                            <div style={{ fontWeight: 700, color: row.direction === "debit" ? text.primary : "#047857" }}>
                              {formatMoney(row.amount, row.direction)}
                            </div>
                            <div style={{ color: text.muted, fontSize: "0.8rem" }}>{formatDateLabel(row.occurredAt)}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};
