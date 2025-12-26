import React from "react";

type Props = {
  usage: {
    unitsCount?: number;
    screeningsCount?: number;
  } | null;
};

export function BillingPreviewCard({ usage }: Props) {
  const units = usage?.unitsCount ?? 0;
  const screenings = usage?.screeningsCount ?? 0;
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 14,
        padding: 16,
        background: "#f8fafc",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", color: "#475569" }}>
            Billing — Preview
          </div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Starter plan (no charges during Micro-Live)</div>
        </div>
        <span
          style={{
            padding: "6px 10px",
            borderRadius: 999,
            border: "1px solid #cbd5e1",
            background: "#e2e8f0",
            fontSize: 12,
            fontWeight: 700,
            color: "#0f172a",
          }}
        >
          Preview
        </span>
      </div>

      <div style={{ marginTop: 10 }}>
        <ul style={{ paddingLeft: 16, margin: 0, color: "#0f172a", fontSize: 13, lineHeight: 1.6 }}>
          <li>Units: {units}</li>
          <li>
            Screenings: {screenings} × $19.95 (shown for transparency, invoiced later)
          </li>
        </ul>
      </div>

      <div style={{ marginTop: 10, fontSize: 12, color: "#475569" }}>
        No charges during Micro-Live. Invoices will be issued before charging begins. "Enable billing" coming soon.
      </div>
    </div>
  );
}
