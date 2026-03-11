import React, { useEffect, useState } from "react";
import { getTenantLedger, type TenantLedgerItem } from "../../api/tenantLedgerApi";

const cardStyle: React.CSSProperties = {
  background: "rgba(17, 24, 39, 0.8)",
  border: "1px solid rgba(255, 255, 255, 0.05)",
  borderRadius: 16,
  padding: "18px 20px",
  boxShadow: "0 12px 32px rgba(0,0,0,0.35)",
};

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
    <div style={cardStyle}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ color: "#9ca3af", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Ledger
        </div>
        <div style={{ fontSize: 20, fontWeight: 700 }}>Activity timeline</div>
        <div style={{ color: "#9ca3af", fontSize: 13 }}>Verified record of your tenancy activity.</div>
      </div>

      {error ? (
        <div style={{ color: "#fca5a5" }}>{error}</div>
      ) : loading ? (
        <div style={{ color: "#cbd5e1" }}>Loading ledger…</div>
      ) : items.length === 0 ? (
        <div style={{ color: "#9ca3af" }}>No ledger events yet.</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {items.map((item) => (
            <div
              key={item.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 10,
                alignItems: "center",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12,
                padding: "10px 12px",
                background: "rgba(15,23,42,0.35)",
              }}
            >
              <div style={{ display: "grid", gap: 4 }}>
                <div style={{ color: "#e2e8f0", fontWeight: 700 }}>{item.title || "Ledger entry"}</div>
                <div style={{ color: "#94a3b8", fontSize: 13 }}>
                  {item.type} • {item.period || formatDate(item.occurredAt)}
                </div>
                {item.description ? (
                  <div style={{ color: "#cbd5e1", fontSize: 13 }}>{item.description}</div>
                ) : null}
              </div>
              <div style={{ color: "#f8fafc", fontWeight: 800 }}>
                {formatAmount(item.amountCents, item.currency)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TenantLedgerPage;
