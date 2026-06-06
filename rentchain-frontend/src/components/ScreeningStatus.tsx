import React from "react";
import type { ScreeningRequestProjection } from "../api/providerNeutralScreeningApi";

const labelByStatus: Record<string, string> = {
  pending: "Pending",
  provider_pending: "Awaiting provider",
  completed: "Result available",
  manual_completed: "Manual report uploaded",
  failed: "Failed",
  expired: "Expired",
};

export function ScreeningStatus({ request }: { request: ScreeningRequestProjection | null }) {
  if (!request) {
    return (
      <div data-testid="screening-status-empty" style={panelStyle}>
        No screening request selected.
      </div>
    );
  }

  return (
    <div data-testid="screening-status" style={panelStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div>
          <div style={{ fontWeight: 800 }}>Screening request</div>
          <div style={{ color: "#64748b", fontSize: 13 }}>{request.requestId}</div>
        </div>
        <span style={badgeStyle}>{labelByStatus[request.status] || request.status}</span>
      </div>
      <div style={gridStyle}>
        <span>Tenant</span>
        <strong>{request.tenantId}</strong>
        <span>Decision</span>
        <strong>{request.decisionStatus.replace("_", " ")}</strong>
        <span>Requested</span>
        <strong>{request.initiatedAt}</strong>
        <span>Result</span>
        <strong>{request.resultReceivedAt || "Not received"}</strong>
      </div>
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  border: "1px solid #dbe3ef",
  borderRadius: 8,
  background: "#fff",
  padding: 16,
  display: "grid",
  gap: 12,
};

const badgeStyle: React.CSSProperties = {
  border: "1px solid #bfdbfe",
  borderRadius: 999,
  background: "#eff6ff",
  color: "#1d4ed8",
  padding: "5px 10px",
  fontSize: 12,
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(90px, 140px) minmax(0, 1fr)",
  gap: 8,
  color: "#475569",
  fontSize: 13,
};

export default ScreeningStatus;
