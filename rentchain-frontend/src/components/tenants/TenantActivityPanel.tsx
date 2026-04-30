import React, { useEffect, useState } from "react";
import { colors, radius, text } from "../../styles/tokens";
import { listTenantEvents, type TenantEvent } from "../../api/tenantEvents";

type Props = {
  tenantId: string | null | undefined;
  refreshKey?: number;
};

function toMillis(ts: unknown): number | null {
  if (ts == null) return null;
  if (typeof ts === "number") return ts;
  if (typeof ts === "object" && ts !== null) {
    const candidate = ts as { toMillis?: () => number; seconds?: number };
    if (typeof candidate.toMillis === "function") return candidate.toMillis();
    if (typeof candidate.seconds === "number") return candidate.seconds * 1000;
  }
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "Failed to load tenant activity";
}

export const TenantActivityPanel: React.FC<Props> = ({ tenantId, refreshKey = 0 }) => {
  const [items, setItems] = useState<TenantEvent[]>([]);
  const [nextCursor, setNextCursor] = useState<string | number | null>(null);
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
      const resp = await listTenantEvents({
        tenantId,
        limit: 25,
        cursor: initial ? undefined : nextCursor ?? undefined,
      });
      const newItems = Array.isArray(resp?.items) ? resp.items : [];
      setItems((prev) => (initial ? newItems : [...prev, ...newItems]));
      setNextCursor(resp?.nextCursor ?? null);
    } catch (error: unknown) {
      setError(getErrorMessage(error));
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
  }, [tenantId, refreshKey]);

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
            const occurred = toMillis(evt.occurredAt);
            const created = toMillis(evt.createdAt);
            const when = occurred || created ? new Date(occurred || created || 0).toLocaleString() : "";

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
