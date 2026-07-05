import React from "react";
import { Button, Card } from "../ui/Ui";
import type { ContractorProfileV1 } from "../../api/marketplaceContractorApi";

export default function ContractorCard({
  contractor,
  actionLabel,
  onAction,
  actions,
  disabled,
}: {
  contractor: ContractorProfileV1;
  actionLabel?: string;
  onAction?: () => void;
  actions?: Array<{ label: string; onClick: () => void; disabled?: boolean }>;
  disabled?: boolean;
}) {
  return (
    <Card style={{ display: "grid", gap: 8, minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", flexWrap: "wrap", minWidth: 0 }}>
        <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
          <div className="rc-wrap-text" style={{ fontWeight: 700 }}>{contractor.displayName}</div>
          {contractor.businessName ? <div className="rc-wrap-text" style={{ color: "#475569" }}>{contractor.businessName}</div> : null}
        </div>
        <span style={{ fontSize: "0.85rem", color: "#334155" }}>{contractor.availabilityStatus}</span>
      </div>
      <div className="rc-wrap-text" style={{ color: "#64748b", fontSize: "0.92rem" }}>
        {contractor.summary || "Service profile available for maintenance assignment."}
      </div>
      <div className="rc-wrap-text" style={{ color: "#475569", fontSize: "0.92rem" }}>
        Categories: {contractor.serviceCategories.length ? contractor.serviceCategories.join(", ") : "-"}
      </div>
      <div className="rc-wrap-text" style={{ color: "#475569", fontSize: "0.92rem" }}>
        Areas: {contractor.serviceAreas.length ? contractor.serviceAreas.join(", ") : "-"}
      </div>
      <div className="rc-wrap-text" style={{ color: "#475569", fontSize: "0.92rem" }}>
        Contact: {contractor.contact.email || contractor.contact.phone || "-"}
      </div>
      {actions?.length ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {actions.map((action) => (
            <Button key={action.label} type="button" onClick={action.onClick} disabled={action.disabled}>
              {action.label}
            </Button>
          ))}
        </div>
      ) : actionLabel && onAction ? (
        <div>
          <Button type="button" onClick={onAction} disabled={disabled}>
            {actionLabel}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
