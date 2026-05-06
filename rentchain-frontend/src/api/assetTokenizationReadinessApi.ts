import { apiFetch } from "./apiFetch";

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
  canonicalEvents: Array<{ eventType: string; action: string; status: AssetTokenizationReadinessStatus; resourceId: string; summary: string }>;
};

export async function fetchAssetTokenizationReadiness(params?: {
  propertyId?: string;
  assetType?: AssetTokenizationAssetType | "";
  status?: AssetTokenizationReadinessStatus | "";
}): Promise<AssetTokenizationReadiness[]> {
  const search = new URLSearchParams();
  if (params?.propertyId) search.set("propertyId", params.propertyId);
  if (params?.assetType) search.set("assetType", params.assetType);
  if (params?.status) search.set("status", params.status);
  const suffix = search.toString() ? `?${search.toString()}` : "";
  const response = await apiFetch<{ ok: true; readiness: AssetTokenizationReadiness[] }>(`/landlord/asset-tokenization-readiness${suffix}`);
  return response.readiness;
}

export async function fetchAssetTokenizationReadinessItem(assetReadinessId: string): Promise<AssetTokenizationReadiness> {
  const response = await apiFetch<{ ok: true; readiness: AssetTokenizationReadiness }>(
    `/landlord/asset-tokenization-readiness/${encodeURIComponent(assetReadinessId)}`
  );
  return response.readiness;
}
