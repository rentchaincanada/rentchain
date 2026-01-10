import React, { useEffect, useState } from "react";
import { fetchLedger, type LedgerEventStored } from "../../api/ledgerApi";
import { LedgerTimeline } from "../../components/ledger/LedgerTimeline";

const cardStyle: React.CSSProperties = {
  background: "rgba(17, 24, 39, 0.8)",
  border: "1px solid rgba(255, 255, 255, 0.05)",
  borderRadius: 16,
  padding: "18px 20px",
  boxShadow: "0 12px 32px rgba(0,0,0,0.35)",
};

export const TenantLedgerPage: React.FC = () => {
  const [items, setItems] = useState<LedgerEventStored[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchLedger({ limit: 50 });
        if (!cancelled) setItems(Array.isArray(res) ? res : []);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load ledger");
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
        <LedgerTimeline items={items} />
      )}
    </div>
  );
};

export default TenantLedgerPage;
