export type RentalHistoryLedgerStatus = "verified" | "partially_verified" | "review_required" | "blocked" | "unknown";

export type RentalHistoryEntryType =
  | "lease_participation"
  | "occupancy"
  | "maintenance_history"
  | "review_verification"
  | "delinquency_review"
  | "export_reference"
  | "evidence_reference";

export type RentalHistoryEntryStatus = "verified" | "partially_verified" | "blocked" | "unavailable";

export type RentalHistoryCanonicalEventType =
  | "rental_history_ledger_derived"
  | "rental_history_entry_verified"
  | "rental_history_review_required"
  | "rental_history_blocked"
  | "rental_history_redaction_applied";

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
  entryType: RentalHistoryEntryType;
  status: RentalHistoryEntryStatus;
  propertyReference: RentalHistoryReference | null;
  leaseReference: RentalHistoryReference | null;
  occupancyPeriod: {
    startDate: string | null;
    endDate: string | null;
  };
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

export type RentalHistoryCanonicalEvent = {
  eventType: RentalHistoryCanonicalEventType;
  action: string;
  status: RentalHistoryLedgerStatus;
  resourceType: "rental_history_ledger";
  resourceId: string;
  summary: string;
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
  canonicalEvents: RentalHistoryCanonicalEvent[];
};

export type DeriveVerifiedRentalHistoryInput = {
  landlordId?: unknown;
  identityId?: unknown;
  generatedAt?: unknown;
  tenant?: Record<string, unknown> | null;
  leases?: Array<Record<string, unknown>> | null;
  properties?: Array<Record<string, unknown>> | null;
  maintenanceRequests?: Array<Record<string, unknown>> | null;
  decisions?: Array<Record<string, unknown>> | null;
  operatorReviewSessions?: Array<Record<string, unknown>> | null;
  evidencePacks?: Array<Record<string, unknown>> | null;
  identityReferences?: Array<Record<string, unknown>> | null;
  consentRecords?: Array<Record<string, unknown>> | null;
  canonicalEvents?: Array<Record<string, unknown>> | null;
};
