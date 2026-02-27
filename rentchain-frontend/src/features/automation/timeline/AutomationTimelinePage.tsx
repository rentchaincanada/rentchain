import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/useAuth";
import { useAutomationTimeline } from "./useAutomationTimeline";
import type { AutomationEvent, AutomationEventType } from "./automationTimeline.types";
import { canUseTimeline } from "./timelineEntitlements";

type FilterValue = "ALL" | AutomationEventType;

const filterOptions: Array<{ label: string; value: FilterValue }> = [
  { label: "All", value: "ALL" },
  { label: "Lease", value: "LEASE" },
  { label: "Screening", value: "SCREENING" },
  { label: "Payment", value: "PAYMENT" },
  { label: "Messages", value: "MESSAGE" },
  { label: "Property", value: "PROPERTY" },
  { label: "Tenant", value: "TENANT" },
  { label: "System", value: "SYSTEM" },
];

const formatTime = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

const badgeColorByType: Record<AutomationEventType, string> = {
  LEASE: "#0f766e",
  SCREENING: "#1d4ed8",
  PAYMENT: "#7c2d12",
  MESSAGE: "#6d28d9",
  PROPERTY: "#92400e",
  TENANT: "#166534",
  SYSTEM: "#334155",
};

const entityOrder: Array<keyof NonNullable<AutomationEvent["entity"]>> = [
  "propertyId",
  "unitId",
  "tenantId",
  "applicationId",
  "leaseId",
  "paymentId",
];

export default function AutomationTimelinePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const userPlan = String(user?.plan || "").trim().toLowerCase();
  const timelineEnabled = canUseTimeline(userPlan);
  const { events, loading, error, mode, integrityMode, headChainHash, sources, refresh } =
    useAutomationTimeline({ enabled: timelineEnabled });
  const [filter, setFilter] = useState<FilterValue>("ALL");

  const visibleEvents = useMemo(
    () => (filter === "ALL" ? events : events.filter((event) => event.type === filter)),
    [events, filter]
  );

  const handleExport = () => {
    const payload = JSON.stringify(visibleEvents, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "rentchain-automation-timeline-mock.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleCopyHash = async (value?: string | null) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // no-op
    }
  };

  if (!timelineEnabled) {
    return (
      <section style={{ display: "grid", gap: 14, padding: 20 }}>
        <header style={{ display: "grid", gap: 4 }}>
          <h1 style={{ margin: 0 }}>Automation Timeline</h1>
          <p style={{ margin: 0, color: "#475569" }}>Unified Event Ledger (v1.3)</p>
        </header>
        <div
          style={{
            border: "1px solid #dbeafe",
            background: "#eff6ff",
            borderRadius: 12,
            padding: 16,
            display: "grid",
            gap: 10,
            maxWidth: 780,
          }}
        >
          <div style={{ fontWeight: 800, color: "#1e3a8a" }}>Timeline is available on Pro and Elite plans.</div>
          <div style={{ color: "#334155", fontSize: 14 }}>
            Upgrade to unlock live event history, integrity checks, and export workflows.
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => navigate("/pricing")}
              style={{
                border: "1px solid #1d4ed8",
                background: "#1d4ed8",
                color: "#fff",
                borderRadius: 10,
                padding: "8px 12px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Upgrade plan
            </button>
            <button
              type="button"
              onClick={() => navigate("/billing")}
              style={{
                border: "1px solid #bfdbfe",
                background: "#fff",
                color: "#1d4ed8",
                borderRadius: 10,
                padding: "8px 12px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Open billing
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section style={{ display: "grid", gap: 14, padding: 20 }}>
      <header style={{ display: "grid", gap: 4 }}>
        <h1 style={{ margin: 0 }}>Automation Timeline</h1>
        <p style={{ margin: 0, color: "#475569" }}>Unified Event Ledger (v1.3)</p>
        <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
          {mode === "live" ? "Live events (read-only)" : "Mock fallback (no live events yet)"}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: integrityMode === "verified" ? "#166534" : "#92400e",
              background: integrityMode === "verified" ? "#dcfce7" : "#fef3c7",
              border: `1px solid ${integrityMode === "verified" ? "#86efac" : "#fcd34d"}`,
              borderRadius: 999,
              padding: "4px 8px",
            }}
          >
            Integrity: {integrityMode === "verified" ? "Verified" : "Unverified"}
          </span>
          {headChainHash ? (
            <button
              type="button"
              onClick={() => void handleCopyHash(headChainHash)}
              style={{
                border: "1px solid #cbd5e1",
                background: "#fff",
                borderRadius: 8,
                padding: "4px 8px",
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              Copy head hash
            </button>
          ) : null}
        </div>
        {import.meta.env.DEV ? (
          <p style={{ margin: 0, fontSize: 12, color: "#94a3b8" }}>
            Sources: {sources.ok.length} ok / {sources.tried.length} tried
          </p>
        ) : null}
        {error ? (
          <p style={{ margin: 0, fontSize: 12, color: "#b45309" }}>{error}</p>
        ) : null}
      </header>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {filterOptions.map((option) => {
            const selected = filter === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setFilter(option.value)}
                style={{
                  border: selected ? "1px solid #2563eb" : "1px solid #cbd5e1",
                  background: selected ? "#dbeafe" : "#ffffff",
                  color: selected ? "#1d4ed8" : "#0f172a",
                  borderRadius: 999,
                  padding: "6px 10px",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          style={{
            border: "1px solid #cbd5e1",
            background: "#ffffff",
            borderRadius: 10,
            padding: "7px 12px",
            fontSize: 12,
            fontWeight: 700,
            cursor: loading ? "default" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>

        <button
          type="button"
          onClick={handleExport}
          style={{
            border: "1px solid #cbd5e1",
            background: "#ffffff",
            borderRadius: 10,
            padding: "7px 12px",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Export (JSON)
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gap: 12,
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          padding: 14,
          background: "#ffffff",
        }}
      >
        {visibleEvents.length === 0 ? (
          <div style={{ color: "#64748b", padding: 6 }}>No events for this filter.</div>
        ) : (
          visibleEvents.map((event, index) => {
            const entities = entityOrder
              .map((key) => [key, event.entity?.[key]] as const)
              .filter((entry) => !!entry[1]);

            return (
              <div
                key={event.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "22px 1fr",
                  gap: 12,
                }}
              >
                <div style={{ display: "grid", justifyItems: "center" }}>
                  <div
                    aria-hidden
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: badgeColorByType[event.type],
                      marginTop: 8,
                    }}
                  />
                  {index < visibleEvents.length - 1 ? (
                    <div aria-hidden style={{ width: 2, flex: 1, background: "#e2e8f0" }} />
                  ) : null}
                </div>

                <article
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: 10,
                    padding: 12,
                    display: "grid",
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ fontWeight: 800 }}>{event.title}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          color: badgeColorByType[event.type],
                          background: "#f8fafc",
                          border: `1px solid ${badgeColorByType[event.type]}33`,
                          borderRadius: 999,
                          padding: "4px 8px",
                        }}
                      >
                        {event.type}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          color: (event.metadata as any)?.integrity ? "#166534" : "#92400e",
                          background: (event.metadata as any)?.integrity ? "#dcfce7" : "#fef3c7",
                          border: `1px solid ${(event.metadata as any)?.integrity ? "#86efac" : "#fcd34d"}`,
                          borderRadius: 999,
                          padding: "4px 8px",
                        }}
                      >
                        {(event.metadata as any)?.integrity ? "Verified" : "Unverified"}
                      </span>
                      {(event.metadata as any)?.integrity?.chainHash ? (
                        <button
                          type="button"
                          onClick={() => void handleCopyHash((event.metadata as any)?.integrity?.chainHash)}
                          style={{
                            border: "1px solid #cbd5e1",
                            background: "#fff",
                            borderRadius: 8,
                            padding: "3px 7px",
                            fontSize: 11,
                            cursor: "pointer",
                          }}
                        >
                          Copy hash
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div style={{ fontSize: 12, color: "#475569" }}>{formatTime(event.occurredAt)}</div>

                  {event.summary ? (
                    <div style={{ fontSize: 13, color: "#334155" }}>{event.summary}</div>
                  ) : null}

                  {entities.length > 0 ? (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {entities.map(([key, value]) => (
                        <span
                          key={`${event.id}-${key}`}
                          style={{
                            fontSize: 11,
                            color: "#334155",
                            background: "#f8fafc",
                            border: "1px solid #e2e8f0",
                            borderRadius: 999,
                            padding: "3px 8px",
                          }}
                        >
                          {key}: {String(value)}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </article>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
