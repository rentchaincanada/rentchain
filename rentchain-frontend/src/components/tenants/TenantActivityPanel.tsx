// @ts-nocheck
import React, { useEffect, useState } from "react";
import type { AuditEvent } from "../../types/events";
import { fetchTenantEvents } from "../../api/eventsApi";

interface TenantActivityPanelProps {
  tenantId: string | null | undefined;
}

export const TenantActivityPanel: React.FC<TenantActivityPanelProps> = ({
  tenantId,
}) => {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!tenantId) {
      setEvents([]);
      setError(null);
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchTenantEvents(tenantId, 25);
        if (!cancelled) {
          setEvents(data);
        }
      } catch (err) {
        console.error("[TenantActivityPanel] Failed to load events", err);
        if (!cancelled) {
          setError("Failed to load tenant activity");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  const formatTimestamp = (ts: string) => {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return ts;
    return d.toLocaleString();
  };

  const severityColor = (kind: AuditEvent["kind"]) => {
    if (kind === "tenant.payment_deleted") return "#ef4444";
    if (kind === "tenant.payment_edited") return "#eab308";
    if (kind === "application.converted_to_tenant") return "#22c55e";
    if (kind === "application.status_changed") return "#38bdf8";
    return "#9ca3af";
  };

  return (
    <div
      style={{
        marginTop: 12,
        borderRadius: 16,
        padding: 12,
        backgroundColor: "rgba(15,23,42,0.95)",
        border: "1px solid rgba(31,41,55,1)",
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
          color: "#9ca3af",
          marginBottom: 2,
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span>Tenant activity</span>
        <span
          style={{
            fontSize: 11,
            color: "#6b7280",
          }}
        >
          Audit feed for this tenant
        </span>
      </div>

      {tenantId == null ? (
        <div
          style={{
            fontSize: 13,
            color: "#6b7280",
          }}
        >
          Select a tenant to see their activity.
        </div>
      ) : loading ? (
        <div
          style={{
            fontSize: 13,
            color: "#9ca3af",
          }}
        >
          Loading activity…
        </div>
      ) : error ? (
        <div
          style={{
            fontSize: 13,
            color: "#f97316",
          }}
        >
          {error}
        </div>
      ) : events.length === 0 ? (
        <div
          style={{
            fontSize: 13,
            color: "#6b7280",
          }}
        >
          No recent activity recorded for this tenant.
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            maxHeight: 220,
            overflowY: "auto",
          }}
        >
          {events.map((evt, idx) => {
            const key = evt.id || `${evt.entityType}-${evt.entityId}-${idx}`;
            return (
              <div
                key={key}
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
                    backgroundColor: severityColor(evt.kind),
                    boxShadow: "0 0 0 3px rgba(15,23,42,0.7)",
                    flexShrink: 0,
                  }}
                />
                <div
                  style={{
                    flex: 1,
                    borderRadius: 10,
                    padding: "6px 8px",
                    backgroundColor: "rgba(15,23,42,1)",
                    border: "1px solid rgba(55,65,81,0.9)",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontWeight: 500,
                        color: "#e5e7eb",
                        marginBottom: 2,
                      }}
                    >
                      {evt.summary}
                    </div>
                    {evt.detail && (
                      <div
                        style={{
                          color: "#9ca3af",
                        }}
                      >
                        {evt.detail}
                      </div>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#6b7280",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatTimestamp(evt.timestamp)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
