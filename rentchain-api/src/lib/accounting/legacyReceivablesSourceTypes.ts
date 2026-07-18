import type { ReceivableFinding, ReceivableTransaction, ReceivableTransactionType } from "./receivablesTypes";

export const LEGACY_RECEIVABLES_SOURCE_KINDS = [
  "ledger_entry",
  "payment_record",
  "payment_intent",
  "reconciliation_record",
  "lease_obligation",
  "allocation_record",
] as const;

export type LegacyReceivablesSourceKind = (typeof LEGACY_RECEIVABLES_SOURCE_KINDS)[number];
export type LegacyReceivablesEvidenceRole = "posted_transaction" | "preview_obligation" | "corroborating_evidence";

export type LegacyReceivablesOwnershipProof = {
  state: "independently_verified" | "unverified" | "ambiguous";
  landlordId: unknown;
  leaseId: unknown;
};

export type LegacyReceivablesSourceRecord = {
  sourceKind: LegacyReceivablesSourceKind | string;
  sourceId: unknown;
  evidenceRole: LegacyReceivablesEvidenceRole | string;
  landlordId: unknown;
  leaseId: unknown;
  propertyId: unknown;
  unitId?: unknown;
  responsibilityId?: unknown;
  tenantId?: unknown;
  transactionType?: ReceivableTransactionType | string | null;
  amountCents?: unknown;
  currency?: unknown;
  effectiveDate?: unknown;
  dueDate?: unknown;
  periodStart?: unknown;
  periodEnd?: unknown;
  adjustmentDirection?: unknown;
  reversesSourceId?: unknown;
  appliesToSourceId?: unknown;
  canonicalEventKey?: unknown;
  linkedSourceIds?: readonly unknown[];
  sourceVersion?: unknown;
};

export type NormalizeLegacyReceivablesSourcesInput = {
  landlordId: unknown;
  leaseId: unknown;
  propertyId: unknown;
  tenantId?: unknown;
  tenantMappingState: "resolved" | "missing" | "ambiguous" | string;
  ownershipProof: LegacyReceivablesOwnershipProof;
  records: readonly LegacyReceivablesSourceRecord[];
};

export type LegacyReceivablesSourceFinding = ReceivableFinding & {
  sourceKind?: LegacyReceivablesSourceKind | null;
  sourceId?: string | null;
};

export type LegacyReceivablesSourceNormalizationResult = {
  sourceState: "complete" | "incomplete" | "ambiguous";
  transactions: ReceivableTransaction[];
  findings: LegacyReceivablesSourceFinding[];
  sourceFingerprint: string;
};
