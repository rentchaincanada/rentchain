import React from "react";

const LABELS: Record<string, string> = {
  PROPERTY_CREATED: "Property",
  UNIT_CREATED: "Unit",
  TENANT_CREATED: "Tenant",
  LEASE_CREATED: "Lease",
  PAYMENT_RECORDED: "Payment",
  PAYMENT_UPDATED: "Payment",
  NOTE_ADDED: "Note",
  STATUS_CHANGED: "Status",
};

export const LedgerEventTypeBadge: React.FC<{ type: string }> = ({ type }) => {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 8px",
        borderRadius: 999,
        background: "rgba(0,0,0,0.05)",
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      {LABELS[type] || type}
    </span>
  );
};
