import type { LegacyReceivablesSourceRecord } from "./legacyReceivablesSourceTypes";
import type {
  IndependentLegacySignedEffect,
  ReceivablesSourceSnapshotAdapterInput,
  ReceivablesSnapshotLeaseContext,
} from "./receivablesSourceSnapshotTypes";

export const RECEIVABLES_AUTHORITATIVE_SOURCE_PROVIDER_VERSION = "receivables_authoritative_source_provider_v1" as const;
export const RECEIVABLES_AUTHORITATIVE_SOURCE_MANIFEST_VERSION = "receivables_authoritative_source_manifest_v1" as const;

export type ReceivablesAuthoritativeSourceClass =
  | "ownership" | "lease" | "property" | "unit" | "tenant"
  | "ledger" | "payment" | "payment_intent" | "reconciliation" | "obligation" | "allocation"
  | "legacy_effects";

export type ReceivablesAuthoritativeCompletenessState =
  | "complete" | "empty_confirmed" | "unknown" | "partial" | "ambiguous" | "unavailable";

export type ReceivablesAuthoritativeReadReceipt<T> = {
  sourceClass: ReceivablesAuthoritativeSourceClass | string;
  sourceVersion: unknown;
  readBoundaryVersion: unknown;
  completenessState: ReceivablesAuthoritativeCompletenessState | string;
  authoritative: unknown;
  capped: unknown;
  completenessProven: unknown;
  postReadFiltered: unknown;
  aliasOwnershipMapping: unknown;
  catchToEmpty: unknown;
  suitableForFinancialDiagnostics: unknown;
  reasonCodes: readonly unknown[];
  scope: { landlordId: unknown; leaseId: unknown; propertyId?: unknown };
  records: readonly T[];
};

export type ReceivablesAuthoritativeOwnershipRecord = {
  proofSource: unknown;
  landlordId: unknown;
  leaseId: unknown;
  leaseLandlordId: unknown;
  propertyId: unknown;
  propertyLandlordId: unknown;
};

export type ReceivablesAuthoritativeLeaseRecord = ReceivablesSnapshotLeaseContext & {
  canonicalLandlordId: unknown;
  directDocument: unknown;
  ownershipField: unknown;
  ownershipAliasConflict: unknown;
};

export type ReceivablesAuthoritativePropertyRecord = {
  propertyId: unknown;
  landlordId: unknown;
  displayName: unknown;
};

export type ReceivablesAuthoritativeUnitRecord = {
  unitId: unknown;
  propertyId: unknown;
  landlordId: unknown;
  displayName: unknown;
};

export type ReceivablesAuthoritativeTenantRecord = {
  tenantId: unknown;
  leaseId: unknown;
  displayName: unknown;
};

export type ReceivablesAuthoritativeSourceProviderReceipts = {
  ownership: ReceivablesAuthoritativeReadReceipt<ReceivablesAuthoritativeOwnershipRecord>;
  lease: ReceivablesAuthoritativeReadReceipt<ReceivablesAuthoritativeLeaseRecord>;
  property: ReceivablesAuthoritativeReadReceipt<ReceivablesAuthoritativePropertyRecord>;
  unit: ReceivablesAuthoritativeReadReceipt<ReceivablesAuthoritativeUnitRecord>;
  tenant: ReceivablesAuthoritativeReadReceipt<ReceivablesAuthoritativeTenantRecord>;
  ledger: ReceivablesAuthoritativeReadReceipt<LegacyReceivablesSourceRecord>;
  payment: ReceivablesAuthoritativeReadReceipt<LegacyReceivablesSourceRecord>;
  paymentIntent: ReceivablesAuthoritativeReadReceipt<LegacyReceivablesSourceRecord>;
  reconciliation: ReceivablesAuthoritativeReadReceipt<LegacyReceivablesSourceRecord>;
  obligation: ReceivablesAuthoritativeReadReceipt<LegacyReceivablesSourceRecord>;
  allocation: ReceivablesAuthoritativeReadReceipt<LegacyReceivablesSourceRecord>;
  legacyEffects: ReceivablesAuthoritativeReadReceipt<IndependentLegacySignedEffect>;
};

export type BuildReceivablesAuthoritativeSourceInput = {
  providerEnabled: unknown;
  sourceManifestVersion: unknown;
  target: { landlordId: unknown; leaseId: unknown; context: unknown };
  comparatorConfig: ReceivablesSourceSnapshotAdapterInput["comparatorConfig"];
  asOfDate: unknown;
  previewThroughDate: unknown;
  receipts?: Partial<ReceivablesAuthoritativeSourceProviderReceipts>;
};

export type ReceivablesAuthoritativeSourceProviderReasonCode =
  | "PROVIDER_DISABLED" | "PROVIDER_MANIFEST_VERSION_MISMATCH" | "PROVIDER_TARGET_INVALID"
  | "PROVIDER_RECEIPT_MISSING" | "PROVIDER_RECEIPT_CLASS_MISMATCH" | "PROVIDER_RECEIPT_VERSION_MISSING"
  | "PROVIDER_READ_BOUNDARY_MISMATCH" | "PROVIDER_SOURCE_NOT_AUTHORITATIVE" | "PROVIDER_SOURCE_UNSUITABLE"
  | "PROVIDER_SOURCE_ALIAS_REJECTED" | "PROVIDER_SOURCE_POST_FILTER_REJECTED" | "PROVIDER_SOURCE_CATCH_TO_EMPTY_REJECTED"
  | "PROVIDER_SOURCE_CAPPED_INCOMPLETE" | "PROVIDER_SOURCE_INCOMPLETE" | "PROVIDER_SOURCE_STATE_CONFLICT"
  | "PROVIDER_SCOPE_MISMATCH" | "PROVIDER_OWNERSHIP_MISSING" | "PROVIDER_OWNERSHIP_AMBIGUOUS"
  | "PROVIDER_OWNERSHIP_UNVERIFIED" | "PROVIDER_MAPPING_INCOMPLETE" | "PROVIDER_MAPPING_AMBIGUOUS"
  | "PROVIDER_MAPPING_CONFLICT" | "PROVIDER_DISPLAY_LABEL_MISSING" | "PROVIDER_DISPLAY_ID_FALLBACK_REJECTED"
  | "PROVIDER_UNSAFE_SOURCE_DATA" | "PROVIDER_EVIDENCE_KIND_MISMATCH" | "PROVIDER_CANONICAL_NORMALIZATION_FAILED";

export type ReceivablesAuthoritativeSourceProviderResult = {
  providerCoreVersion: typeof RECEIVABLES_AUTHORITATIVE_SOURCE_PROVIDER_VERSION;
  status: "safe" | "not_ready" | "ambiguous" | "unsafe";
  reasonCodes: ReceivablesAuthoritativeSourceProviderReasonCode[];
  warnings: string[];
  ownershipProofSummary: { status: "verified" | "unverified" | "ambiguous"; method: "canonical_direct" | "none" };
  sourceCompletenessSummary: { status: "complete" | "incomplete" | "ambiguous"; completeCount: number; emptyCount: number };
  safeSnapshotInput: ReceivablesSourceSnapshotAdapterInput | null;
  unsafeFieldSummary: { detected: boolean; categories: string[] };
  receiptSummary: { requiredCount: number; acceptedCount: number; manifestVersion: typeof RECEIVABLES_AUTHORITATIVE_SOURCE_MANIFEST_VERSION };
};
