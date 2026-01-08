import React, { useEffect, useState } from "react";
import { colors, radius, text } from "../../styles/tokens";
import { getMyTenantEvents, type TenantEvent } from "../../api/tenantEvents";

type Props = {
  tenantId: string | null | undefined;
};

function toMillis(ts: any): number | null {
  if (ts == null) return null;
  if (typeof ts === "number") return ts;
  if (typeof ts?.toMillis === "function") return ts.toMillis();
  if (typeof ts?.seconds === "number") return ts.seconds * 1000;
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

export const TenantActivityPanel: React.FC<Props> = ({ tenantId }) => {
  const [items, setItems] = useState<TenantEvent[]>([]);
  const [nextCursor, setNextCursor] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(initial = false) {
    if (!tenantId) {
      setItems([]);
      setNextCursor(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const resp = await getMyTenantEvents(25);
      const newItems = (resp as any)?.items || [];
      setItems(initial ? newItems : [...items, ...newItems]);
      setNextCursor(null);
    } catch (e: any) {
      setError(e?.message || "Failed to load tenant activity");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await load(true);
      if (cancelled) {
        setItems([]);
        setNextCursor(null);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const canLoadMore = !!nextCursor && !loading;

  return (
    <div
      style={{
        marginTop: 12,
        borderRadius: 16,
        padding: 12,
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
          marginBottom: 2,
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span>Tenant activity</span>
        <button
          type="button"
          onClick={() => load(true)}
          disabled={loading}
          style={{
            border: "none",
            background: "none",
            color: text.muted,
            cursor: loading ? "not-allowed" : "pointer",
            padding: 0,
            fontSize: 12,
          }}
        >
          Refresh
        </button>
      </div>

      {tenantId == null ? (
        <div style={{ fontSize: 13, color: text.muted }}>
          Select a tenant to see their activity.
        </div>
      ) : loading && items.length === 0 ? (
        <div style={{ fontSize: 13, color: text.muted }}>Loading activity…</div>
      ) : error ? (
        <div style={{ fontSize: 13, color: "#f97316" }}>{error}</div>
      ) : items.length === 0 ? (
        <div style={{ fontSize: 13, color: text.muted }}>
          No recent activity recorded for this tenant.
        </div>
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
          {items.map((evt) => {
            const created = toMillis(evt.createdAt);
            const when = created ? new Date(created).toLocaleString() : "";

            return (
              <div
                key={evt.id}
                style={{
                  display: "flex",
                  gap: 8,
                  fontSize: 12,
                }}
              >
                <div
                  style={{
                    marginTop: 5,
                    width: 8,
                    height: 8,
                    borderRadius: "999px",
                    backgroundColor: text.primary,
                    opacity: 0.7,
                    flexShrink: 0,
                  }}
                />
                <div
                  style={{
                    flex: 1,
                    borderRadius: 10,
                    padding: "6px 8px",
                    backgroundColor: colors.card,
                    border: `1px solid ${colors.border}`,
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontWeight: 600,
                        color: text.primary,
                        marginBottom: 2,
                      }}
                    >
                      {evt.title || evt.type}
                    </div>
                    {evt.description ? (
                      <div style={{ color: text.muted }}>{evt.description}</div>
                    ) : null}
                    <div style={{ fontSize: 11, color: text.muted }}>
                      {evt.type}
                      {typeof evt.amountCents === "number"
                        ? ` • ${(evt.amountCents / 100).toFixed(2)} ${evt.currency || ""}`.trim()
                        : ""}
                      {typeof evt.daysLate === "number" ? ` • ${evt.daysLate} days late` : ""}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: text.muted,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {when}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {canLoadMore ? (
        <button
          type="button"
          onClick={() => load(false)}
          disabled={loading}
          style={{
            alignSelf: "flex-start",
            borderRadius: radius.pill,
            border: `1px solid ${colors.border}`,
            background: colors.card,
            color: text.primary,
            padding: "6px 10px",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          Load more
        </button>
      ) : null}
    </div>
  );
};
