import { apiFetch } from "./apiFetch";

export type SupportOperationsStatus = "stable" | "attention_required" | "review_required" | "blocked" | "unknown";
export type SupportReferenceType = "support" | "onboarding" | "credentialing" | "incident" | "operational_risk" | "review" | "evidence" | "audit";
export type SupportReferenceStatus = "verified" | "partially_verified" | "blocked" | "unavailable";

export type SupportOperationsReference = {
  referenceId: string;
  referenceType: SupportReferenceType;
  status: SupportReferenceStatus;
  label: string;
  description: string;
  reviewRequired: true;
  lineageReferences: string[];
  destination: string | null;
  redacted: boolean;
  redactionReason: string | null;
  blockedReason: string | null;
};

export type SupportRestriction = {
  restrictionId: string;
  restrictionType: SupportReferenceType | "autonomous_support" | "admin_impersonation" | "operator_override" | "public_support";
  status: "visible" | "blocked" | "review_required";
  label: string;
  description: string;
  blockedReason: string | null;
};

export type SupportOperationsProfile = {
  supportOperationsId: string;
  status: SupportOperationsStatus;
  manualReviewRequired: true;
  autonomousSupportExecutionEnabled: false;
  adminImpersonationEnabled: false;
  generatedAt: string;
  summary: {
    totalReferences: number;
    verifiedReferences: number;
    partiallyVerifiedReferences: number;
    blockedReferences: number;
    unavailableReferences: number;
    restrictions: number;
  };
  supportReferences: SupportOperationsReference[];
  onboardingReferences: SupportOperationsReference[];
  credentialingReferences: SupportOperationsReference[];
  incidentReferences: SupportOperationsReference[];
  operationalRiskReferences: SupportOperationsReference[];
  reviewReferences: SupportOperationsReference[];
  evidenceReferences: SupportOperationsReference[];
  auditReferences: SupportOperationsReference[];
  supportRestrictions: SupportRestriction[];
  redactions: string[];
  blockedReasons: string[];
  canonicalEvents: Array<{ eventType: string; action: string; status: SupportOperationsStatus; resourceId: string; summary: string }>;
};

export async function fetchSupportOperationsProfiles(params?: {
  status?: SupportOperationsStatus | "";
}): Promise<SupportOperationsProfile[]> {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  const suffix = search.toString() ? `?${search.toString()}` : "";
  const response = await apiFetch<{ ok: true; profiles: SupportOperationsProfile[] }>(`/admin/support-operations${suffix}`);
  return response.profiles;
}

export async function fetchSupportOperationsProfile(supportOperationsId: string): Promise<SupportOperationsProfile> {
  const response = await apiFetch<{ ok: true; profile: SupportOperationsProfile }>(
    `/admin/support-operations/${encodeURIComponent(supportOperationsId)}`
  );
  return response.profile;
}
