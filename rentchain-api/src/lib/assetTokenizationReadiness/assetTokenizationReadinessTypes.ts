import type { RegulatoryProfile } from "../regulatoryProfiles/regulatoryProfileTypes";
import type { SettlementReadiness } from "../settlementReadiness/settlementReadinessTypes";

export type AssetTokenizationReadinessStatus = "eligible_for_review" | "partially_ready" | "blocked" | "unknown";
export type AssetTokenizationAssetType = "property" | "lease_cashflow" | "operational_asset";
export type AssetTokenizationReferenceStatus = "verified" | "partially_verified" | "blocked" | "unavailable";
export type AssetTokenizationReferenceType =
  | "property_identity"
  | "lease_cashflow"
  | "occupancy"
  | "maintenance_performance"
  | "settlement_readiness"
  | "regulatory_profile"
  | "review_lineage"
  | "evidence_lineage";

export type AssetTokenizationEventType =
  | "asset_tokenization_readiness_derived"
  | "asset_tokenization_review_required"
  | "asset_tokenization_blocked"
  | "asset_tokenization_restriction_detected"
  | "asset_tokenization_redaction_applied";

export type AssetTokenizationReference = {
  assetReferenceId: string;
  referenceType: AssetTokenizationReferenceType;
  status: AssetTokenizationReferenceStatus;
  label: string;
  description: string;
  reviewRequired: true;
  tokenizationEligible: false;
  sourceId: string | null;
  destination: string | null;
  redacted: boolean;
  redactionReason: string | null;
  blockedReason: string | null;
};

export type AssetTokenizationCanonicalEvent = {
  eventType: AssetTokenizationEventType;
  action: string;
  status: AssetTokenizationReadinessStatus;
  resourceType: "asset_tokenization_readiness";
  resourceId: string;
  summary: string;
};

export type AssetTokenizationReadiness = {
  assetReadinessId: string;
  assetType: AssetTokenizationAssetType;
  status: AssetTokenizationReadinessStatus;
  manualReviewRequired: true;
  tokenIssuanceEnabled: false;
  blockchainIntegrationEnabled: false;
  publicMarketplaceEnabled: false;
  generatedAt: string;
  summary: {
    totalReferences: number;
    verifiedReferences: number;
    partiallyVerifiedReferences: number;
    blockedReferences: number;
    unavailableReferences: number;
    tokenizationEligibleReferences: number;
  };
  assetReferences: AssetTokenizationReference[];
  cashflowReferences: AssetTokenizationReference[];
  occupancyReferences: AssetTokenizationReference[];
  maintenancePerformanceReferences: AssetTokenizationReference[];
  settlementReadinessReferences: AssetTokenizationReference[];
  regulatoryProfileReferences: AssetTokenizationReference[];
  reviewReferences: AssetTokenizationReference[];
  evidenceReferences: AssetTokenizationReference[];
  redactions: string[];
  blockedReasons: string[];
  canonicalEvents: AssetTokenizationCanonicalEvent[];
};

export type DeriveAssetTokenizationReadinessInput = {
  landlordId?: unknown;
  propertyId?: unknown;
  assetType?: unknown;
  generatedAt?: unknown;
  properties?: Record<string, unknown>[] | null;
  leases?: Record<string, unknown>[] | null;
  obligationRows?: Record<string, unknown>[] | null;
  maintenanceRequests?: Record<string, unknown>[] | null;
  evidencePacks?: Record<string, unknown>[] | null;
  operatorReviewSessions?: Record<string, unknown>[] | null;
  auditEvents?: Record<string, unknown>[] | null;
  settlementReadiness?: SettlementReadiness | null;
  regulatoryProfiles?: RegulatoryProfile[] | null;
};
