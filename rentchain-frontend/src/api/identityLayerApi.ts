import { apiFetch } from "./apiFetch";

export type IdentityLayerType = "tenant" | "property" | "organization" | "operator" | "review_actor";
export type IdentityLayerStatus = "verified" | "partially_verified" | "review_required" | "blocked" | "unknown";

export type IdentityLayerReference = {
  referenceId: string;
  referenceType:
    | "tenant_profile"
    | "property_registry"
    | "organization"
    | "operator_review"
    | "canonical_event"
    | "screening"
    | "consent"
    | "evidence"
    | "unknown";
  label: string;
  status: "available" | "missing" | "blocked" | "redacted";
  destination: string | null;
  occurredAt: string | null;
  redacted: boolean;
  blockedReason: string | null;
};

export type IdentityLayerProfile = {
  identityId: string;
  identityType: IdentityLayerType;
  status: IdentityLayerStatus;
  manualReviewRequired: true;
  publiclyShareable: false;
  externalInstitutionSharingEnabled: false;
  tokenizationEnabled: false;
  verificationSummary: {
    totalReferences: number;
    verifiedReferences: number;
    missingReferences: number;
    blockedReferences: number;
  };
  consentSummary: {
    consentAvailable: boolean;
    consentScope: string[];
    consentReferences: number;
    missingConsentReasons: string[];
  };
  portabilitySummary: {
    portableReferenceAvailable: boolean;
    portabilityStatus: "ready" | "limited" | "not_ready";
    blockedReasons: string[];
  };
  lineageReferences: IdentityLayerReference[];
  verificationReferences: IdentityLayerReference[];
  consentReferences: IdentityLayerReference[];
  reviewReferences: IdentityLayerReference[];
  redactions: string[];
  blockedReasons: string[];
  canonicalEvents: Array<{
    eventType: string;
    action: string;
    status: IdentityLayerStatus;
    resourceType: IdentityLayerType;
    resourceId: string;
    summary: string;
  }>;
  generatedAt: string;
};

export type IdentityLayerProfileQuery = {
  identityType?: IdentityLayerType;
  identityId?: string;
};

export async function fetchIdentityLayerProfile(params?: IdentityLayerProfileQuery): Promise<IdentityLayerProfile> {
  const search = new URLSearchParams();
  if (params?.identityType) search.set("identityType", params.identityType);
  if (params?.identityId) search.set("identityId", params.identityId);
  const suffix = search.toString() ? `?${search.toString()}` : "";
  const response = await apiFetch<{ ok: true; profile: IdentityLayerProfile }>(`/landlord/identity-layer/profile${suffix}`);
  return response.profile;
}
