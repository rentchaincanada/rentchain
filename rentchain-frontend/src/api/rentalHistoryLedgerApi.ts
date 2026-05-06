import { apiFetch } from "./apiFetch";

export type RentalHistoryLedgerStatus = "verified" | "partially_verified" | "review_required" | "blocked" | "unknown";
export type RentalHistoryEntryStatus = "verified" | "partially_verified" | "blocked" | "unavailable";

export type RentalHistoryReference = {
  referenceId: string;
  referenceType:
    | "identity"
    | "lease"
    | "property"
    | "operator_review"
    | "evidence"
    | "canonical_event"
    | "maintenance"
    | "delinquency"
    | "consent";
  label: string;
  status: "available" | "missing" | "blocked" | "redacted";
  destination: string | null;
  occurredAt: string | null;
  redacted: boolean;
  blockedReason: string | null;
};

export type RentalHistoryEntry = {
  historyEntryId: string;
  entryType:
    | "lease_participation"
    | "occupancy"
    | "maintenance_history"
    | "review_verification"
    | "delinquency_review"
    | "export_reference"
    | "evidence_reference";
  status: RentalHistoryEntryStatus;
  propertyReference: RentalHistoryReference | null;
  leaseReference: RentalHistoryReference | null;
  occupancyPeriod: { startDate: string | null; endDate: string | null };
  verificationSummary: {
    verifiedReferences: number;
    missingReferences: number;
    blockedReferences: number;
  };
  reviewLineage: RentalHistoryReference[];
  evidenceLineage: RentalHistoryReference[];
  redacted: boolean;
  redactionReason: string | null;
  blockedReason: string | null;
};

export type VerifiedRentalHistoryLedger = {
  ledgerId: string;
  identityId: string;
  ledgerType: "tenant_rental_history";
  status: RentalHistoryLedgerStatus;
  manualReviewRequired: true;
  publiclyShareable: false;
  externalInstitutionSharingEnabled: false;
  tokenizationEnabled: false;
  generatedAt: string;
  summary: {
    totalEntries: number;
    verifiedEntries: number;
    partiallyVerifiedEntries: number;
    blockedEntries: number;
    unavailableEntries: number;
    propertiesReferenced: number;
    leasesReferenced: number;
    maintenanceReferences: number;
    delinquencyReviewReferences: number;
  };
  historyEntries: RentalHistoryEntry[];
  verificationReferences: RentalHistoryReference[];
  reviewReferences: RentalHistoryReference[];
  evidenceReferences: RentalHistoryReference[];
  consentReferences: RentalHistoryReference[];
  redactions: string[];
  blockedReasons: string[];
  canonicalEvents: Array<{ eventType: string; action: string; status: RentalHistoryLedgerStatus; resourceId: string; summary: string }>;
};

export async function fetchRentalHistoryLedgers(params?: {
  identityId?: string;
  propertyId?: string;
  status?: RentalHistoryLedgerStatus | "";
}): Promise<VerifiedRentalHistoryLedger[]> {
  const search = new URLSearchParams();
  if (params?.identityId) search.set("identityId", params.identityId);
  if (params?.propertyId) search.set("propertyId", params.propertyId);
  if (params?.status) search.set("status", params.status);
  const suffix = search.toString() ? `?${search.toString()}` : "";
  const response = await apiFetch<{ ok: true; ledgers: VerifiedRentalHistoryLedger[] }>(`/landlord/rental-history-ledger${suffix}`);
  return response.ledgers;
}

export async function fetchRentalHistoryLedger(ledgerId: string): Promise<VerifiedRentalHistoryLedger> {
  const response = await apiFetch<{ ok: true; ledger: VerifiedRentalHistoryLedger }>(
    `/landlord/rental-history-ledger/${encodeURIComponent(ledgerId)}`
  );
  return response.ledger;
}
