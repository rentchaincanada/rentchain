import React from "react";
import { Button, Card } from "../ui/Ui";
import type { ContractorProfileV1 } from "../../api/marketplaceContractorApi";

export default function ContractorCard({
  contractor,
  actionLabel,
  onAction,
  disabled,
}: {
  contractor: ContractorProfileV1;
  actionLabel?: string;
  onAction?: () => void;
  disabled?: boolean;
}) {
  return (
    <Card style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ fontWeight: 700 }}>{contractor.displayName}</div>
          {contractor.businessName ? <div style={{ color: "#475569" }}>{contractor.businessName}</div> : null}
        </div>
        <span style={{ fontSize: "0.85rem", color: "#334155" }}>{contractor.availabilityStatus}</span>
      </div>
      <div style={{ color: "#64748b", fontSize: "0.92rem" }}>
        {contractor.summary || "Service profile available for maintenance assignment."}
      </div>
      <div style={{ color: "#475569", fontSize: "0.92rem" }}>
        Categories: {contractor.serviceCategories.length ? contractor.serviceCategories.join(", ") : "-"}
      </div>
      <div style={{ color: "#475569", fontSize: "0.92rem" }}>
        Areas: {contractor.serviceAreas.length ? contractor.serviceAreas.join(", ") : "-"}
      </div>
      <div style={{ color: "#475569", fontSize: "0.92rem" }}>
        Contact: {contractor.contact.email || contractor.contact.phone || "-"}
      </div>
      {actionLabel && onAction ? (
        <div>
          <Button type="button" onClick={onAction} disabled={disabled}>
            {actionLabel}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
