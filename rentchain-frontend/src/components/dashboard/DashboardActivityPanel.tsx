import React, { useEffect, useState } from "react";
import { listRecentTenantEvents, type TenantEvent } from "../../api/tenantEvents";
import { colors, text, radius } from "../../styles/tokens";

function toMillis(ts: any): number | null {
  if (!ts) return null;
  if (typeof ts === "number") return ts;
  if (typeof ts?.toMillis === "function") return ts.toMillis();
  if (typeof ts?.seconds === "number") return ts.seconds * 1000;
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

export const DashboardActivityPanel: React.FC = () => {
  const [events, setEvents] = useState<TenantEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await listRecentTenantEvents(25);
      setEvents(data?.items || []);
    } catch (err: any) {
      console.error("[DashboardActivityPanel] Failed to load events", err);
      setError(err?.message || "Failed to load recent activity");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const formatTimestamp = (ts: any) => {
    const ms = toMillis(ts);
    if (!ms) return "";
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString();
  };

  return (
    <div
      style={{
        borderRadius: 16,
        padding: 14,
        backgroundColor: colors.panel,
        border: `1px solid ${colors.border}`,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        minHeight: 0,
      }}
    >
      <div
        style={{
          fontSize: 12,
          textTransform: "uppercase",
          letterSpacing: 0.08,
          color: text.muted,
          marginBottom: 4,
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span>Recent activity</span>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          style={{
            border: "none",
            background: "none",
            color: text.muted,
            cursor: loading ? "not-allowed" : "pointer",
            fontSize: 11,
            padding: 0,
          }}
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div style={{ fontSize: 13, color: text.muted }}>Loading…</div>
      ) : error ? (
        <div style={{ fontSize: 13, color: "#f97316" }}>{error}</div>
      ) : events.length === 0 ? (
        <div style={{ fontSize: 13, color: text.muted }}>No recent activity recorded yet.</div>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            maxHeight: 260,
            overflowY: "auto",
          }}
        >
          {events.map((evt) => {
            const key = evt.id || `${evt.type}-${evt.tenantId}-${evt.occurredAt}`;
            return (
              <div
                key={key}
                style={{
                  borderRadius: 10,
                  padding: "6px 8px",
                  backgroundColor: colors.card,
                  border: `1px solid ${colors.border}`,
                  fontSize: 12,
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <div>
                  <div style={{ fontWeight: 500, color: text.primary, marginBottom: 2 }}>
                    {evt.title || evt.type}
                  </div>
                  {evt.description ? (
                    <div style={{ color: text.muted, marginBottom: 2 }}>{evt.description}</div>
                  ) : null}
                  <div style={{ fontSize: 11, color: text.muted }}>{evt.type}</div>
                </div>
                <div style={{ fontSize: 11, color: text.muted, whiteSpace: "nowrap" }}>
                  {formatTimestamp(evt.createdAt)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
