import type { LegacyReceivablesSourceRecord } from "./legacyReceivablesSourceTypes";
import type {
  CompareReceivablesShadowInput,
  ReceivablesShadowComparatorConfig,
  ReceivablesShadowSourceState,
} from "./receivablesShadowComparatorTypes";

export const RECEIVABLES_SOURCE_SNAPSHOT_VERSION = "receivables_source_snapshot_v1" as const;

export type ReceivablesSnapshotMappingState = "resolved" | "missing" | "ambiguous";
export type ReceivablesSnapshotUnitMappingState = ReceivablesSnapshotMappingState | "not_applicable";

export type ReceivablesSnapshotOwnershipContext = {
  proofSource: "authoritative_lease" | "in_memory_fallback" | "missing" | "ambiguous" | string;
  landlordId: unknown;
  leaseId: unknown;
  leaseLandlordId: unknown;
  propertyId: unknown;
  propertyLandlordId: unknown;
};

export type ReceivablesSnapshotLeaseContext = {
  leaseId: unknown;
  landlordId: unknown;
  propertyId: unknown;
  unitId?: unknown;
  responsibilityId?: unknown;
  tenantId?: unknown;
  propertyDisplayName?: unknown;
  unitDisplayName?: unknown;
  tenantDisplayName?: unknown;
  responsibilityDisplayName?: unknown;
  leaseMappingState: ReceivablesSnapshotMappingState | string;
  propertyMappingState: ReceivablesSnapshotMappingState | string;
  unitMappingState: ReceivablesSnapshotUnitMappingState | string;
  tenantMappingState: ReceivablesSnapshotMappingState | string;
  leaseStatus: unknown;
  leaseStartDate: unknown;
  leaseEndDate?: unknown;
  monthlyRentCents: unknown;
  dueDay: unknown;
  billingFrequency: unknown;
  currency: unknown;
  depositAmountCents?: unknown;
  sourceLeaseVersion: unknown;
};

export type ReceivablesSnapshotEvidenceBatch = {
  state: ReceivablesShadowSourceState | string;
  records: readonly LegacyReceivablesSourceRecord[];
};

export type ReceivablesSnapshotEvidenceBatches = {
  ledgerEntries: ReceivablesSnapshotEvidenceBatch;
  paymentRecords: ReceivablesSnapshotEvidenceBatch;
  paymentIntents: ReceivablesSnapshotEvidenceBatch;
  reconciliationRecords: ReceivablesSnapshotEvidenceBatch;
  leaseObligations: ReceivablesSnapshotEvidenceBatch;
  allocationRecords: ReceivablesSnapshotEvidenceBatch;
};

export type IndependentLegacySignedEffect = {
  effectId: unknown;
  landlordId: unknown;
  leaseId: unknown;
  propertyId: unknown;
  currency: unknown;
  effectiveDate: unknown;
  signedAmountCents: unknown;
};

export type ReceivablesSourceSnapshotAdapterInput = {
  comparatorConfig: ReceivablesShadowComparatorConfig;
  ownership: ReceivablesSnapshotOwnershipContext;
  lease: ReceivablesSnapshotLeaseContext;
  evidence: ReceivablesSnapshotEvidenceBatches;
  legacyEffectsState: "complete" | "empty_confirmed" | "unavailable" | "ambiguous" | "truncated" | string;
  legacyEffects: readonly IndependentLegacySignedEffect[];
  asOfDate: unknown;
  previewThroughDate: unknown;
};

export type ReceivablesSourceSnapshotReasonCode =
  | "SNAPSHOT_CONFIG_NOT_READY"
  | "SNAPSHOT_OWNERSHIP_MISSING"
  | "SNAPSHOT_OWNERSHIP_FALLBACK_REJECTED"
  | "SNAPSHOT_OWNERSHIP_AMBIGUOUS"
  | "SNAPSHOT_SCOPE_MISMATCH"
  | "SNAPSHOT_MAPPING_INCOMPLETE"
  | "SNAPSHOT_MAPPING_AMBIGUOUS"
  | "SNAPSHOT_BILLING_TERMS_INCOMPLETE"
  | "SNAPSHOT_CURRENCY_UNSUPPORTED"
  | "SNAPSHOT_FREQUENCY_UNSUPPORTED"
  | "SNAPSHOT_SOURCE_INCOMPLETE"
  | "SNAPSHOT_SOURCE_AMBIGUOUS"
  | "SNAPSHOT_SOURCE_BATCH_KIND_MISMATCH"
  | "SNAPSHOT_UNSAFE_SOURCE_DATA"
  | "SNAPSHOT_NORMALIZATION_FAILED"
  | "SNAPSHOT_LEGACY_PROJECTION_UNAVAILABLE"
  | "SNAPSHOT_LEGACY_PROJECTION_INVALID";

export type ReceivablesSourceSnapshotStatus = "ready" | "incomplete" | "ambiguous" | "unsafe";

export type ReceivablesSourceCounts = {
  ledgerEntries: number;
  paymentRecords: number;
  paymentIntents: number;
  reconciliationRecords: number;
  leaseObligations: number;
  allocationRecords: number;
  legacyEffects: number;
};

export type InternalReceivablesSourceSnapshotPackage = {
  snapshotVersion: typeof RECEIVABLES_SOURCE_SNAPSHOT_VERSION;
  status: ReceivablesSourceSnapshotStatus;
  reasonCodes: ReceivablesSourceSnapshotReasonCode[];
  warnings: string[];
  ownershipVerified: boolean;
  completenessStatus: "complete" | "incomplete" | "ambiguous";
  sourceCounts: ReceivablesSourceCounts;
  normalizedSourceSummary: {
    status: "complete" | "incomplete" | "ambiguous" | "not_run";
    recordCount: number;
    legacyEffectCount: number;
  };
  comparatorInput: CompareReceivablesShadowInput | null;
};
