import React from "react";
import { Card } from "../ui/Ui";
import ContractorCard from "./ContractorCard";
import type { ContractorProfileV1 } from "../../api/marketplaceContractorApi";

export default function ContractorAssignmentPanel({
  currentAssignment,
  contractors,
  loading,
  assigning,
  onAssign,
}: {
  currentAssignment?: { displayName?: string | null; businessName?: string | null } | null;
  contractors: ContractorProfileV1[];
  loading?: boolean;
  assigning?: boolean;
  onAssign: (contractorId: string) => void;
}) {
  return (
    <Card style={{ display: "grid", gap: 10 }}>
      <div style={{ fontWeight: 600 }}>Marketplace contractor assignment</div>
      {currentAssignment?.displayName ? (
        <div style={{ color: "#334155" }}>
          Current assignment: <strong>{currentAssignment.displayName}</strong>
          {currentAssignment.businessName ? ` (${currentAssignment.businessName})` : ""}
        </div>
      ) : (
        <div style={{ color: "#64748b" }}>No marketplace contractor is currently assigned.</div>
      )}
      {loading ? (
        <div>Loading contractor candidates...</div>
      ) : contractors.length === 0 ? (
        <div style={{ color: "#64748b" }}>No contractors match the current category and area filters.</div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {contractors.map((contractor) => (
            <ContractorCard
              key={contractor.id}
              contractor={contractor}
              actionLabel="Assign to work order"
              onAction={() => onAssign(contractor.id)}
              disabled={assigning}
            />
          ))}
        </div>
      )}
    </Card>
  );
}
