import React, { useEffect, useState } from "react";
import { getLedgerEventV2, LedgerEventV2 } from "../../api/ledgerV2";
import { LedgerEventTypeBadge } from "./LedgerEventTypeBadge";

interface Props {
  eventId: string | null;
  onClose: () => void;
}

export const LedgerEventDrawer: React.FC<Props> = ({ eventId, onClose }) => {
  const [item, setItem] = useState<LedgerEventV2 | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!eventId) return;
    setLoading(true);
    setError(null);
    getLedgerEventV2(eventId)
      .then((res) => {
        if (!cancelled) setItem(res.item);
      })
      .catch((e: any) => {
        if (!cancelled) setError(e?.message || "Failed to load event");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [eventId]);

  if (!eventId) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        width: 360,
        height: "100vh",
        background: "#fff",
        boxShadow: "-2px 0 8px rgba(0,0,0,0.1)",
        padding: 16,
        overflow: "auto",
        zIndex: 30,
      }}
    >
      <button onClick={onClose} style={{ float: "right" }}>
        Close
      </button>
      {loading ? <div>Loading…</div> : null}
      {error ? <div style={{ color: "red" }}>{error}</div> : null}
      {item ? (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0 }}>{item.title}</h3>
            <LedgerEventTypeBadge type={item.eventType} />
          </div>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
            {new Date(item.occurredAt).toLocaleString()}
          </div>
          {item.summary ? <div style={{ marginTop: 8 }}>{item.summary}</div> : null}
          <div style={{ marginTop: 10, fontSize: 12, color: "#4b5563" }}>
            Property: {item.propertyId || "-"} • Tenant: {item.tenantId || "-"}
          </div>
          <pre
            style={{
              marginTop: 12,
              background: "#f9fafb",
              padding: 8,
              borderRadius: 8,
              fontSize: 12,
              overflow: "auto",
            }}
          >
            {JSON.stringify(item.metadata || {}, null, 2)}
          </pre>
        </div>
      ) : null}
    </div>
  );
};
