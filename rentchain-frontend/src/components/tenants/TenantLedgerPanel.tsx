// @ts-nocheck
// src/components/tenant/TenantLedgerPanel.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  fetchTenantLedger,
  TenantLedgerEvent,
} from "../../services/tenantLedgerApi";

type TenantLedgerPanelProps = {
  tenantId: string;
};

type MonthlyGroup = {
  monthKey: string;
  label: string;
  events: TenantLedgerEvent[];
  monthNet: number;
};

function groupEventsByMonth(events: TenantLedgerEvent[] = []): MonthlyGroup[] {
  const byMonth = new Map<string, MonthlyGroup>();

  for (const ev of events) {
    // defensive: if date is missing or invalid, fall back to "Unknown"
    const d = ev.date ? new Date(ev.date) : new Date();
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = isNaN(d.getTime())
      ? "Unknown period"
      : d.toLocaleString("default", { month: "long", year: "numeric" });

    let bucket = byMonth.get(key);
    if (!bucket) {
      bucket = { monthKey: key, label, events: [], monthNet: 0 };
      byMonth.set(key, bucket);
    }

    bucket.events.push(ev);
    bucket.monthNet += ev.amount;
  }

  return Array.from(byMonth.values()).sort((a, b) =>
    a.monthKey.localeCompare(b.monthKey)
  );
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const typeLabel: Record<string, string> = {
  RentCharge: "Rent charge",
  PaymentReceived: "Payment received",
  LateFee: "Late fee",
};

export const TenantLedgerPanel: React.FC<TenantLedgerPanelProps> = ({
  tenantId,
}) => {
  const [events, setEvents] = useState<TenantLedgerEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) return;

    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const ledger = await fetchTenantLedger(tenantId);
        if (cancelled) return;

        // defensive: always coerce to an array
        const safeEvents = Array.isArray(ledger?.events) ? ledger.events : [];
        setEvents(safeEvents);
      } catch (err: any) {
        if (cancelled) return;
        console.error("[TenantLedgerPanel] Failed to load ledger:", err);
        setError("Unable to load ledger events.");
        setEvents([]); // keep it an empty array to avoid runtime errors
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  const grouped = useMemo(() => groupEventsByMonth(events), [events]);

  const currentBalance = useMemo(() => {
    if (!events || events.length === 0) return 0;
    const withBalance = events.filter((e) => typeof e.balanceAfter === "number");
    if (withBalance.length > 0) {
      return withBalance[withBalance.length - 1].balanceAfter as number;
    }
    // fallback: sum amounts
    return events.reduce((sum, ev) => sum + (ev.amount || 0), 0);
  }, [events]);

  if (!tenantId) {
    return null;
  }

  return (
    <div
      style={{
        background: "radial-gradient(circle at top, #020617 0, #020617 40%, #000 100%)",
        borderRadius: "1.25rem",
        border: "1px solid rgba(148,163,184,0.35)",
        padding: "1.15rem 1.25rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.9rem",
        boxShadow: "0 18px 40px rgba(15,23,42,0.8)",
        height: "100%",
        minHeight: "260px",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "0.75rem",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div
            style={{
              fontSize: "0.9rem",
              fontWeight: 600,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              color: "#9ca3af",
            }}
          >
            Ledger Timeline
          </div>
          <div
            style={{
              fontSize: "0.75rem",
              color: "#6b7280",
            }}
          >
            Charges, payments & fees grouped by month
          </div>
        </div>

        <div
          style={{
            padding: "0.4rem 0.7rem",
            borderRadius: "999px",
            border: "1px solid rgba(56,189,248,0.4)",
            background:
              currentBalance > 0
                ? "linear-gradient(90deg, rgba(248,250,252,0.02), rgba(248,113,113,0.1))"
                : "linear-gradient(90deg, rgba(248,250,252,0.02), rgba(45,212,191,0.12))",
            fontSize: "0.75rem",
            fontWeight: 500,
            color: "#e5e7eb",
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "999px",
              background:
                currentBalance > 0
                  ? "radial-gradient(circle, #f97373 0, #b91c1c 70%)"
                  : "radial-gradient(circle, #6ee7b7 0, #0f766e 70%)",
            }}
          />
          <span>Balance</span>
          <span style={{ fontWeight: 600 }}>{formatCurrency(currentBalance)}</span>
        </div>
      </div>

      {/* Body */}
      <div
        style={{
          flex: 1,
          borderRadius: "0.9rem",
          background:
            "linear-gradient(135deg, rgba(15,23,42,0.92), rgba(15,23,42,0.98))",
          border: "1px solid rgba(30,64,175,0.5)",
          padding: "0.75rem 0.75rem 0.5rem",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
        }}
      >
        {/* Loading / error / empty states */}
        {loading && (
          <div
            style={{
              fontSize: "0.8rem",
              color: "#9ca3af",
              padding: "0.4rem 0.25rem",
            }}
          >
            Loading ledger…
          </div>
        )}

        {!loading && error && (
          <div
            style={{
              fontSize: "0.8rem",
              color: "#f97373",
              padding: "0.4rem 0.25rem",
            }}
          >
            {error}
          </div>
        )}

        {!loading && !error && events.length === 0 && (
          <div
            style={{
              fontSize: "0.8rem",
              color: "#9ca3af",
              padding: "0.4rem 0.25rem",
            }}
          >
            No ledger events yet for this tenant.
          </div>
        )}

        {/* Timeline list */}
        {!loading && !error && events.length > 0 && (
          <div
            style={{
              marginTop: "0.25rem",
              paddingRight: "0.3rem",
              overflowY: "auto",
              maxHeight: 260,
            }}
          >
            <div
              style={{
                borderLeft: "1px dashed rgba(75,85,99,0.7)",
                paddingLeft: "0.75rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              {grouped.map((group) => (
                <div key={group.monthKey}>
                  {/* Month header */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "0.3rem",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        color: "#e5e7eb",
                      }}
                    >
                      {group.label}
                    </div>
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "#9ca3af",
                      }}
                    >
                      Net:{" "}
                      <span
                        style={{
                          color: group.monthNet >= 0 ? "#f97373" : "#6ee7b7",
                          fontWeight: 500,
                        }}
                      >
                        {formatCurrency(group.monthNet)}
                      </span>
                    </div>
                  </div>

                  {/* Events for the month */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.25rem",
                    }}
                  >
                    {group.events.map((ev, idx) => {
                      const label =
                        typeLabel[ev.type] ?? ev.type ?? "Ledger event";
                      const isCredit = ev.amount < 0;
                      const isFee = ev.type === "LateFee";

                      return (
                        <div
                          key={ev.id || `${group.monthKey}-${idx}`}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "minmax(0, 1.3fr) minmax(0, 1fr)",
                            gap: "0.65rem",
                            padding: "0.4rem 0.5rem",
                            borderRadius: "0.65rem",
                            background:
                              "linear-gradient(90deg, rgba(15,23,42,0.9), rgba(15,23,42,0.95))",
                            border: "1px solid rgba(31,41,55,0.9)",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 2,
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.4rem",
                                fontSize: "0.8rem",
                                fontWeight: 500,
                                color: "#e5e7eb",
                              }}
                            >
                              <span
                                style={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: "999px",
                                  background: isCredit
                                    ? "radial-gradient(circle, #6ee7b7 0, #0f766e 70%)"
                                    : isFee
                                    ? "radial-gradient(circle, #f97373 0, #b91c1c 70%)"
                                    : "radial-gradient(circle, #38bdf8 0, #1d4ed8 70%)",
                                }}
                              />
                              <span>{label}</span>
                            </div>
                            <div
                              style={{
                                fontSize: "0.75rem",
                                color: "#9ca3af",
                              }}
                            >
                              {ev.description || "No description"}
                            </div>
                          </div>

                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "flex-end",
                              gap: 2,
                              fontSize: "0.75rem",
                            }}
                          >
                            <div style={{ color: "#9ca3af" }}>
                              {formatDate(ev.date)}
                            </div>
                            <div
                              style={{
                                fontWeight: 600,
                                color: isCredit ? "#6ee7b7" : "#f97373",
                              }}
                            >
                              {formatCurrency(ev.amount)}
                            </div>
                            <div
                              style={{
                                marginTop: 2,
                                fontSize: "0.7rem",
                                color: "#6b7280",
                              }}
                            >
                              Balance after:{" "}
                              <span style={{ color: "#e5e7eb" }}>
                                {formatCurrency(
                                  typeof ev.balanceAfter === "number"
                                    ? ev.balanceAfter
                                    : currentBalance
                                )}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
