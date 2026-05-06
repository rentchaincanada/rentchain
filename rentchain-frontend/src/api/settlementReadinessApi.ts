import { apiFetch } from "./apiFetch";

export type SettlementReadinessStatus = "ready_for_review" | "partially_ready" | "blocked" | "unknown";
export type SettlementReferenceStatus = "verified" | "partially_verified" | "blocked" | "unavailable";
export type SettlementReferenceType =
  | "payment_event"
  | "ledger_entry"
  | "reconciliation_item"
  | "export_reference"
  | "audit_reference"
  | "delinquency_reference"
  | "review_reference";

export type SettlementReference = {
  settlementReferenceId: string;
  referenceType: SettlementReferenceType;
  status: SettlementReferenceStatus;
  label: string;
  description: string;
  amountSummary: {
    currency: "CAD";
    amount: string | null;
  };
  traceability: {
    ledgerLinked: boolean;
    reviewLinked: boolean;
    evidenceLinked: boolean;
  };
  sourceId: string | null;
  destination: string | null;
  redacted: boolean;
  redactionReason: string | null;
  blockedReason: string | null;
};

export type SettlementDependency = {
  dependencyId: string;
  label: string;
  status: "available" | "missing" | "blocked";
  blockedReason: string | null;
};

export type SettlementReadiness = {
  settlementReadinessId: string;
  status: SettlementReadinessStatus;
  manualReviewRequired: true;
  paymentExecutionEnabled: false;
  bankingIntegrationEnabled: false;
  tokenizationEnabled: false;
  generatedAt: string;
  summary: {
    totalReferences: number;
    verifiedReferences: number;
    partiallyVerifiedReferences: number;
    blockedReferences: number;
    unavailableReferences: number;
    totalLedgerAmount: string;
    totalReconciledAmount: string;
  };
  settlementReferences: SettlementReference[];
  reconciliationReferences: SettlementReference[];
  ledgerReferences: SettlementReference[];
  workflowDependencies: SettlementDependency[];
  evidenceReferences: SettlementReference[];
  reviewReferences: SettlementReference[];
  redactions: string[];
  blockedReasons: string[];
  canonicalEvents: Array<{ eventType: string; action: string; status: SettlementReadinessStatus; resourceId: string; summary: string }>;
};

export async function fetchSettlementReadiness(params?: {
  propertyId?: string;
  leaseId?: string;
  status?: SettlementReadinessStatus | "";
}): Promise<SettlementReadiness[]> {
  const search = new URLSearchParams();
  if (params?.propertyId) search.set("propertyId", params.propertyId);
  if (params?.leaseId) search.set("leaseId", params.leaseId);
  if (params?.status) search.set("status", params.status);
  const suffix = search.toString() ? `?${search.toString()}` : "";
  const response = await apiFetch<{ ok: true; readiness: SettlementReadiness[] }>(`/landlord/settlement-readiness${suffix}`);
  return response.readiness;
}

export async function fetchSettlementReadinessById(settlementReadinessId: string): Promise<SettlementReadiness> {
  const response = await apiFetch<{ ok: true; readiness: SettlementReadiness }>(
    `/landlord/settlement-readiness/${encodeURIComponent(settlementReadinessId)}`
  );
  return response.readiness;
}
