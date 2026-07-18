import type { LandlordLeaseReceivablesAssemblerInput } from "./leaseReceivablesDtoTypes";
import type {
  LegacyReceivablesOwnershipProof,
  NormalizeLegacyReceivablesSourcesInput,
} from "./legacyReceivablesSourceTypes";

export const RECEIVABLES_SHADOW_COMPARISON_VERSION = "receivables_shadow_comparison_v1" as const;

export const RECEIVABLES_SHADOW_SOURCE_KEYS = [
  "lease",
  "property",
  "unit",
  "tenantResponsibility",
  "ledgerEntries",
  "paymentRecords",
  "paymentIntents",
  "reconciliationRecords",
  "leaseObligations",
  "allocationRecords",
] as const;

export type ReceivablesShadowSourceKey = (typeof RECEIVABLES_SHADOW_SOURCE_KEYS)[number];
export type ReceivablesShadowSourceState = "complete" | "empty_confirmed" | "unavailable" | "ambiguous" | "truncated";
export type ReceivablesShadowSourceCompleteness = Record<ReceivablesShadowSourceKey, ReceivablesShadowSourceState>;

export type ReceivablesShadowComparatorConfig = {
  enabled: unknown;
  landlordAllowlist: unknown;
};

export type IndependentLegacyReceivablesProjection = {
  state: "available" | "unavailable" | "incomparable" | string;
  balanceCents?: unknown;
};

export type ReceivablesShadowDtoInput = Omit<
  LandlordLeaseReceivablesAssemblerInput,
  "transactions" | "transactionSourceState" | "legacyBalanceCents"
>;

export type CompareReceivablesShadowInput = {
  config: ReceivablesShadowComparatorConfig;
  requestLandlordId: unknown;
  ownershipProof: LegacyReceivablesOwnershipProof;
  sourceCompleteness: ReceivablesShadowSourceCompleteness;
  normalizationInput: NormalizeLegacyReceivablesSourcesInput;
  dtoInput: ReceivablesShadowDtoInput;
  legacyProjection: IndependentLegacyReceivablesProjection;
};

export type ReceivablesShadowReasonCode =
  | "SHADOW_DISABLED"
  | "SHADOW_NOT_ALLOWLISTED"
  | "SHADOW_OWNERSHIP_UNVERIFIED"
  | "SHADOW_SOURCE_INCOMPLETE"
  | "SHADOW_NORMALIZATION_FAILED"
  | "SHADOW_LEGACY_PARITY_UNAVAILABLE"
  | "SHADOW_DTO_ASSEMBLY_FAILED"
  | "SHADOW_PARITY_MISMATCH"
  | "SHADOW_EQUIVALENT";

export type ReceivablesShadowComparatorStatus = "disabled" | "not_allowed" | "not_ready" | "equivalent";

export type ReceivablesShadowComparatorResult = {
  ok: boolean;
  enabled: boolean;
  allowed: boolean;
  status: ReceivablesShadowComparatorStatus;
  reasonCode: ReceivablesShadowReasonCode;
  warnings: string[];
  comparisonVersion: typeof RECEIVABLES_SHADOW_COMPARISON_VERSION;
};
