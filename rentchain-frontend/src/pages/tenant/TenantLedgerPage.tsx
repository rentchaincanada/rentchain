import React, { useEffect, useState } from "react";
import { Card } from "../../components/ui/Ui";
import { getTenantLedger, type TenantLedgerItem } from "../../api/tenantLedgerApi";
import { colors, spacing, text as textTokens } from "../../styles/tokens";

function formatAmount(amountCents: number | null, currency: string | null) {
  if (typeof amountCents !== "number") return "—";
  try {
    if (currency) {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(amountCents / 100);
    }
  } catch {
    // fall through
  }
  return `$${(amountCents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(ms: number | null | undefined) {
  if (!ms) return "—";
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export const TenantLedgerPage: React.FC = () => {
  const [items, setItems] = useState<TenantLedgerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getTenantLedger();
        if (!cancelled) {
          const list = Array.isArray(res?.data) ? res.data : [];
          setItems(list);
        }
      } catch (e: any) {
        if (!cancelled) {
          const isUnauthorized = e?.payload?.error === "UNAUTHORIZED" || e?.status === 401;
          setError(
            isUnauthorized
              ? "Unable to load your ledger right now. Please refresh and try again."
              : e?.message || "Failed to load ledger"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card elevated style={{ padding: spacing.lg }}>
      <div style={{ marginBottom: spacing.md }}>
        <div style={{ color: textTokens.muted, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Ledger
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: textTokens.primary }}>Activity timeline</div>
        <div style={{ color: textTokens.muted, fontSize: 13 }}>Verified record of your tenancy activity.</div>
      </div>

      {error ? (
        <div style={{ color: colors.danger }}>{error}</div>
      ) : loading ? (
        <div style={{ color: textTokens.muted }}>Loading ledger…</div>
      ) : items.length === 0 ? (
        <div style={{ color: textTokens.muted }}>No ledger events yet.</div>
      ) : (
        <div style={{ display: "grid", gap: spacing.sm }}>
          {items.map((item) => (
            <div
              key={item.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 10,
                alignItems: "center",
                border: `1px solid ${colors.border}`,
                borderRadius: 12,
                padding: "10px 12px",
                background: colors.card,
              }}
            >
              <div style={{ display: "grid", gap: 4 }}>
                <div style={{ color: textTokens.primary, fontWeight: 700 }}>{item.title || "Ledger entry"}</div>
                <div style={{ color: textTokens.muted, fontSize: 13 }}>
                  {item.type} • {item.period || formatDate(item.occurredAt)}
                </div>
                {item.description ? (
                  <div style={{ color: textTokens.secondary, fontSize: 13 }}>{item.description}</div>
                ) : null}
              </div>
              <div style={{ color: textTokens.primary, fontWeight: 800 }}>
                {formatAmount(item.amountCents, item.currency)}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

export default TenantLedgerPage;
