import React from "react";
import { Card } from "../ui/Ui";

export function BoardSnapshotDrawer({
  open,
  onClose,
  snapshot,
}: {
  open: boolean;
  onClose: () => void;
  snapshot: any;
}) {
  if (!open || !snapshot) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        width: "420px",
        maxWidth: "90vw",
        height: "100vh",
        background: "#fff",
        boxShadow: "-8px 0 24px rgba(0,0,0,0.08)",
        borderLeft: "1px solid #e5e7eb",
        zIndex: 2000,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: "14px 16px",
          borderBottom: "1px solid #e5e7eb",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontWeight: 700,
        }}
      >
        Monthly Operations Snapshot
        <button
          onClick={onClose}
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            padding: "6px 8px",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          Close
        </button>
      </div>
      <div style={{ overflow: "auto", padding: 16, flex: 1 }}>
        <section style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Portfolio KPIs</div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 10,
            }}
          >
            <KPI label="Rent Collected" value={`$${snapshot.rentCollected}`} />
            <KPI label="Outstanding Arrears" value={`$${snapshot.arrears}`} />
            <KPI label="Occupancy Rate" value={`${snapshot.occupancy}%`} />
            <KPI label="Active Tenants" value={snapshot.activeTenants} />
          </div>
        </section>

        <section style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Alerts</div>
          {snapshot.alerts && snapshot.alerts.length > 0 ? (
            <div style={{ display: "grid", gap: 6 }}>
              {snapshot.alerts.map((a: string, i: number) => (
                <div
                  key={i}
                  style={{
                    padding: "6px 8px",
                    borderRadius: 8,
                    border: "1px solid #fecdd3",
                    background: "#fef2f2",
                    color: "#b91c1c",
                    fontSize: 12,
                  }}
                >
                  {a}
                </div>
              ))}
            </div>
          ) : (
            <div
              style={{
                padding: "6px 8px",
                borderRadius: 8,
                border: "1px solid #bbf7d0",
                background: "#f0fdf4",
                color: "#166534",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              No critical issues
            </div>
          )}
        </section>

        <section>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>AI Summary</div>
          <Card style={{ padding: 12, fontSize: 13 }}>
            {snapshot.aiSummary || "Summary not available."}
          </Card>
        </section>
      </div>
    </div>
  );
}

function KPI({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 10,
        padding: "10px 12px",
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: 11, color: "#4b5563" }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: "#111827" }}>{value}</div>
    </div>
  );
}
