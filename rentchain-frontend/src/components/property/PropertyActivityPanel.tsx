import React, { useEffect, useState } from "react";
import type { AuditEvent } from "../../types/events";
import { fetchPropertyEvents } from "../../api/eventsApi";

interface PropertyActivityPanelProps {
  propertyId: string | null | undefined;
}

export const PropertyActivityPanel: React.FC<PropertyActivityPanelProps> = ({
  propertyId,
}) => {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!propertyId) {
      setEvents([]);
      setError(null);
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchPropertyEvents(propertyId, 25);
        if (!cancelled) {
          setEvents(Array.isArray((data as any)?.events) ? (data as any).events : []);
        }
      } catch (err) {
        console.warn("[PropertyActivityPanel] Failed to load events", err);
        if (!cancelled) {
          setEvents([]);
          setError("Failed to load property activity");
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
  }, [propertyId]);

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
    if (kind === "ledger.adjustment") return "#f97316";
    return "#9ca3af";
  };

  const safeEvents = Array.isArray(events) ? events : [];
  const safeLength = safeEvents.length;

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
        <span>Property activity</span>
        <span
          style={{
            fontSize: 11,
            color: "#6b7280",
          }}
        >
          Audit feed for this property
        </span>
      </div>

      {propertyId == null ? (
        <div
          style={{
            fontSize: 13,
            color: "#6b7280",
          }}
        >
          Select a property to see its activity.
        </div>
      ) : loading ? (
        <div
          style={{
            fontSize: 13,
            color: "#9ca3af",
          }}
        >
          Loading recent activity…
        </div>
      ) : safeLength === 0 ? (
        <div
          style={{
            fontSize: 13,
            color: "#6b7280",
          }}
        >
          No activity has been recorded for this property yet.
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
          {safeEvents.map((evt, idx) => {
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
