import React, { useEffect, useState } from "react";
import { getTenantLedger, TenantLedgerEntry } from "../../api/tenantPortalApi";
import { useTenantOutletContext } from "./TenantLayout.clean";

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
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export const TenantLedgerPage: React.FC = () => {
  const { lease } = useTenantOutletContext();
  const [entries, setEntries] = useState<TenantLedgerEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getTenantLedger();
        setEntries(data);
      } catch (err: any) {
        setError(err?.message || "Failed to load ledger");
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, []);

  return (
    <div style={cardStyle}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ color: "#9ca3af", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Ledger
        </div>
        <div style={{ fontSize: 20, fontWeight: 700 }}>Activity timeline</div>
        <div style={{ color: "#9ca3af", fontSize: 13 }}>
          {lease?.propertyName || "Your lease"} · {lease?.unitNumber ? `Unit ${lease.unitNumber}` : "Unit"}
        </div>
      </div>

      {error ? (
        <div style={{ color: "#fca5a5" }}>{error}</div>
      ) : isLoading ? (
        <div style={{ color: "#cbd5e1" }}>Loading ledger…</div>
      ) : entries.length === 0 ? (
        <div style={{ color: "#9ca3af" }}>No ledger events yet.</div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {entries.map((entry) => (
            <div
              key={entry.id}
              style={{
                border: "1px solid rgba(255,255,255,0.04)",
                borderRadius: 12,
                padding: "12px 14px",
                background: "rgba(255,255,255,0.01)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ color: "#cbd5e1", fontWeight: 700 }}>{entry.title || entry.type}</div>
                  <div style={{ color: "#9ca3af", fontSize: 13 }}>{entry.description || "—"}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ color: "#e5e7eb", fontWeight: 700 }}>
                    {typeof entry.amount === "number" ? `$${entry.amount.toLocaleString()}` : "—"}
                  </div>
                  <div style={{ color: "#94a3b8", fontSize: 12 }}>{formatDate(entry.occurredAt)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TenantLedgerPage;
