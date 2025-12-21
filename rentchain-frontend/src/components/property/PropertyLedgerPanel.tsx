// @ts-nocheck
// src/components/property/PropertyLedgerPanel.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  LedgerEvent,
  RentPaymentRecordedData,
  PropertyLedgerResponse,
} from "../../types/ledger";
import { API_BASE_URL } from "../../config/api";

interface PropertyLedgerPanelProps {
  propertyId: string;
}

type PropertyEvent = LedgerEvent<RentPaymentRecordedData> | LedgerEvent<any>;

export const PropertyLedgerPanel: React.FC<PropertyLedgerPanelProps> = ({
  propertyId,
}) => {
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<PropertyEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<PropertyLedgerResponse["summary"]>();

  useEffect(() => {
    const fetchLedger = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(
          `${API_BASE_URL}/ledger/property/${encodeURIComponent(
            propertyId
          )}?limit=50`
        );
        const json: PropertyLedgerResponse = await res.json();

        if (!json.success) {
          throw new Error("Failed to load property ledger");
        }

        setEvents(json.events as PropertyEvent[]);
        setSummary(json.summary);
      } catch (err: any) {
        console.error("[PropertyLedgerPanel] Failed to fetch ledger:", err);
        setError(err.message || "Failed to load property ledger");
      } finally {
        setLoading(false);
      }
    };

    fetchLedger();
  }, [propertyId]);

  const latestPayment = useMemo(() => {
    if (!summary?.latestPaymentAt) return null;
    return new Date(summary.latestPaymentAt);
  }, [summary]);

  return (
    <div
      style={{
        marginTop: 16,
        borderRadius: 16,
        padding: 16,
        background: "rgba(15,23,42,0.95)", // dark slate
        border: "1px solid rgba(148,163,184,0.35)",
        color: "#e5e7eb",
      }}
    >
      {/* Header row */}
      <div
        style={{
          marginBottom: 12,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: 14,
            letterSpacing: 0.3,
            textTransform: "uppercase",
            color: "#e5e7eb",
          }}
        >
          Property Ledger &amp; Cashflow
        </h3>
        <span
          style={{
            fontSize: 11,
            color: "#9ca3af",
            whiteSpace: "nowrap",
          }}
        >
          Property ID: {propertyId}
        </span>
      </div>

      {/* Loading / error */}
      {loading && (
        <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 8 }}>
          Loading property ledger…
        </div>
      )}
      {error && (
        <div style={{ color: "#fecaca", fontSize: 13, marginBottom: 8 }}>
          {error}
        </div>
      )}

      {/* Summary row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <SummaryItem
          label="Total payments"
          value={
            summary ? summary.totalPayments.toLocaleString() : "0"
          }
        />
        <SummaryItem
          label="Total amount paid"
          value={formatCurrency(summary?.totalAmountPaid ?? 0)}
        />
        <SummaryItem
          label="Total monthly rent (sum of events)"
          value={formatCurrency(summary?.totalMonthlyRent ?? 0)}
        />
        <SummaryItem
          label="Unique tenants"
          value={summary ? summary.uniqueTenants.toString() : "0"}
        />
        <SummaryItem
          label="Latest payment"
          value={latestPayment ? latestPayment.toLocaleDateString() : "n/a"}
        />
      </div>

      {/* Events table */}
      <div>
        <div
          style={{
            fontWeight: 600,
            fontSize: 12,
            marginBottom: 6,
            color: "#e5e7eb",
          }}
        >
          Recent Events
        </div>

        {events.length === 0 && !loading && (
          <div style={{ fontSize: 13, color: "#9ca3af" }}>
            No events yet for this property.
          </div>
        )}

        {events.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 12,
              }}
            >
              <thead>
                <tr
                  style={{
                    background: "rgba(15,23,42,1)",
                    borderBottom: "1px solid rgba(51,65,85,1)",
                  }}
                >
                  <th style={thStyle}>Time</th>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Details</th>
                  <th style={thStyle}>Amount</th>
                  <th style={thStyle}>Tenant</th>
                  <th style={thStyle}>Blockchain</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev, index) => (
                  <tr
                    key={ev.eventId}
                    style={{
                      borderTop: "1px solid rgba(30,41,59,1)",
                      background:
                        index % 2 === 0
                          ? "rgba(15,23,42,0.9)"
                          : "rgba(15,23,42,0.8)",
                    }}
                  >
                    <td style={tdStyle}>
                      {new Date(ev.timestamp).toLocaleString()}
                    </td>
                    <td style={tdStyle}>
                      {ev.eventType === "RentPaymentRecorded"
                        ? "Rent payment"
                        : ev.eventType}
                    </td>
                    <td style={tdStyle}>
                      {ev.eventType === "RentPaymentRecorded" && (
                        <>
                          <div>
                            Paid{" "}
                            {formatCurrency(
                              (ev.data as RentPaymentRecordedData).amountPaid
                            )}{" "}
                            of{" "}
                            {formatCurrency(
                              (ev.data as RentPaymentRecordedData).monthlyRent
                            )}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: "#9ca3af",
                              marginTop: 2,
                            }}
                          >
                            Due{" "}
                            {formatDate(
                              (ev.data as RentPaymentRecordedData).dueDate
                            )}{" "}
                            · Paid{" "}
                            {formatDate(
                              (ev.data as RentPaymentRecordedData).paidAt
                            )}
                          </div>
                          {(ev.data as RentPaymentRecordedData).notes && (
                            <div
                              style={{
                                fontSize: 11,
                                color: "#cbd5f5",
                                marginTop: 2,
                              }}
                            >
                              {(ev.data as RentPaymentRecordedData).notes}
                            </div>
                          )}
                        </>
                      )}
                    </td>
                    <td style={tdStyle}>
                      {ev.eventType === "RentPaymentRecorded"
                        ? formatCurrency(
                            (ev.data as RentPaymentRecordedData).amountPaid
                          )
                        : "—"}
                    </td>
                    <td style={tdStyle}>
                      {ev.eventType === "RentPaymentRecorded"
                        ? (ev.data as RentPaymentRecordedData).tenantId
                        : "—"}
                    </td>
                    <td style={tdStyle}>
                      {ev.meta?.blockchain?.status ? (
                        <span
                          style={{
                            fontSize: 11,
                            color: "#9ca3af",
                            textTransform: "lowercase",
                          }}
                        >
                          {ev.meta.blockchain.status}
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, color: "#6b7280" }}>
                          n/a
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "6px 8px",
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: 0.6,
  color: "#9ca3af",
};

const tdStyle: React.CSSProperties = {
  padding: "6px 8px",
  verticalAlign: "top",
  color: "#e5e7eb",
};

function SummaryItem(props: { label: string; value: string }) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          color: "#9ca3af",
          marginBottom: 2,
        }}
      >
        {props.label}
      </div>
      <div style={{ fontWeight: 600, fontSize: 13 }}>{props.value}</div>
    </div>
  );
}

function formatCurrency(value?: number): string {
  if (value == null || isNaN(value)) return "—";
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value?: string): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
}
