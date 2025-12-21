// @ts-nocheck
import React, { useEffect, useState } from "react";
import type { AuditEvent } from "../../types/events";
import { fetchRecentEvents } from "../../api/eventsApi";

export const DashboardActivityPanel: React.FC = () => {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchRecentEvents(20);
        if (!cancelled) {
          setEvents(data);
        }
      } catch (err) {
        console.error("[DashboardActivityPanel] Failed to load events", err);
        if (!cancelled) {
          setError("Failed to load recent activity");
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
  }, []);

  const formatTimestamp = (ts: string) => {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return ts;
    return d.toLocaleString();
  };

  const formatEntityLabel = (evt: AuditEvent) => {
    if (evt.entityType === "tenant" && evt.tenantId) {
      return `Tenant ${evt.tenantId}`;
    }
    if (evt.entityType === "property" && evt.propertyId) {
      return `Property ${evt.propertyId}`;
    }
    if (evt.entityType === "application" && evt.applicationId) {
      return `Application ${evt.applicationId}`;
    }
    if (evt.entityType === "payment" && evt.paymentId) {
      return `Payment ${evt.paymentId}`;
    }
    return evt.entityType;
  };

  return (
    <div
      style={{
        borderRadius: 16,
        padding: 14,
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
          marginBottom: 4,
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span>Recent activity</span>
        <span
          style={{
            fontSize: 11,
            color: "#6b7280",
          }}
        >
          Live audit feed
        </span>
      </div>

      {loading ? (
        <div
          style={{
            fontSize: 13,
            color: "#9ca3af",
          }}
        >
          Loading…
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
          No recent activity recorded yet.
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
          {events.map((evt, idx) => {
            const key = evt.id || `${evt.entityType}-${evt.entityId}-${idx}`;
            return (
            <div
              key={key}
              style={{
                borderRadius: 10,
                padding: "6px 8px",
                backgroundColor: "rgba(15,23,42,1)",
                border: "1px solid rgba(55,65,81,0.9)",
                fontSize: 12,
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
                      marginBottom: 2,
                    }}
                  >
                    {evt.detail}
                  </div>
                )}
                <div
                  style={{
                    fontSize: 11,
                    color: "#6b7280",
                  }}
                >
                  {formatEntityLabel(evt)}
                </div>
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
            );
          })}
        </div>
      )}
    </div>
  );
};
