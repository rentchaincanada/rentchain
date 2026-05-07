import { apiFetch } from "./apiFetch";

export type CommercialReadinessStatus = "ready_for_review" | "partially_ready" | "review_required" | "blocked" | "unknown";
export type CommercialReferenceType =
  | "pricing"
  | "billing"
  | "subscription"
  | "onboarding"
  | "support"
  | "operational_risk"
  | "release"
  | "evidence"
  | "review"
  | "audit";
export type CommercialReferenceStatus = "verified" | "partially_verified" | "blocked" | "unavailable";

export type CommercialReference = {
  referenceId: string;
  referenceType: CommercialReferenceType;
  status: CommercialReferenceStatus;
  label: string;
  description: string;
  reviewRequired: true;
  lineageReferences: string[];
  destination: string | null;
  redacted: boolean;
  redactionReason: string | null;
  blockedReason: string | null;
};

export type CommercialRestriction = {
  restrictionId: string;
  restrictionType: CommercialReferenceType | "commercialization" | "billing_execution" | "public_self_service";
  status: "visible" | "blocked" | "review_required";
  label: string;
  description: string;
  blockedReason: string | null;
};

export type CommercialReadinessProfile = {
  commercialReadinessId: string;
  status: CommercialReadinessStatus;
  manualApprovalRequired: true;
  autonomousBillingEnabled: false;
  autonomousCommercializationEnabled: false;
  publicSelfServiceEnabled: false;
  generatedAt: string;
  summary: {
    totalReferences: number;
    verifiedReferences: number;
    partiallyVerifiedReferences: number;
    blockedReferences: number;
    unavailableReferences: number;
    restrictions: number;
  };
  pricingReferences: CommercialReference[];
  billingReferences: CommercialReference[];
  subscriptionReferences: CommercialReference[];
  onboardingReferences: CommercialReference[];
  supportReferences: CommercialReference[];
  operationalRiskReferences: CommercialReference[];
  releaseReferences: CommercialReference[];
  reviewReferences: CommercialReference[];
  evidenceReferences: CommercialReference[];
  auditReferences: CommercialReference[];
  commercialRestrictions: CommercialRestriction[];
  redactions: string[];
  blockedReasons: string[];
  canonicalEvents: Array<{ eventType: string; action: string; status: CommercialReadinessStatus; resourceId: string; summary: string }>;
};

export async function fetchCommercialReadinessProfiles(params?: {
  status?: CommercialReadinessStatus | "";
}): Promise<CommercialReadinessProfile[]> {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  const suffix = search.toString() ? `?${search.toString()}` : "";
  const response = await apiFetch<{ ok: true; profiles: CommercialReadinessProfile[] }>(`/admin/commercial-readiness${suffix}`);
  return response.profiles;
}

export async function fetchCommercialReadinessProfile(commercialReadinessId: string): Promise<CommercialReadinessProfile> {
  const response = await apiFetch<{ ok: true; profile: CommercialReadinessProfile }>(
    `/admin/commercial-readiness/${encodeURIComponent(commercialReadinessId)}`
  );
  return response.profile;
}
