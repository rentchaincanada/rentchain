import { apiFetch } from "./apiFetch";

export type InteroperabilityAdapterType = "lender" | "insurer" | "regulator" | "registry" | "accounting" | "payment_provider" | "operational_partner";
export type InteroperabilityAdapterStatus = "ready_for_review" | "partially_ready" | "review_required" | "blocked" | "unknown";
export type InteroperabilityAdapterReferenceType = "compatibility" | "settlement" | "regulatory" | "evidence" | "review" | "sharing" | "audit";
export type InteroperabilityAdapterReferenceStatus = "verified" | "partially_verified" | "blocked" | "unavailable";

export type InteroperabilityAdapterReference = {
  referenceId: string;
  referenceType: InteroperabilityAdapterReferenceType;
  status: InteroperabilityAdapterReferenceStatus;
  label: string;
  description: string;
  reviewRequired: true;
  lineageReferences: string[];
  destination: string | null;
  redacted: boolean;
  redactionReason: string | null;
  blockedReason: string | null;
};

export type InteroperabilityAdapterRestriction = {
  restrictionId: string;
  restrictionType: "compatibility" | "settlement" | "regulatory" | "evidence" | "review" | "sharing" | "audit" | "risk";
  status: "visible" | "blocked" | "review_required";
  label: string;
  description: string;
  blockedReason: string | null;
};

export type InteroperabilityAdapterReadiness = {
  adapterReadinessId: string;
  adapterType: InteroperabilityAdapterType;
  status: InteroperabilityAdapterStatus;
  manualReviewRequired: true;
  liveIntegrationEnabled: false;
  externalSynchronizationEnabled: false;
  generatedAt: string;
  summary: {
    totalReferences: number;
    verifiedReferences: number;
    partiallyVerifiedReferences: number;
    blockedReferences: number;
    unavailableReferences: number;
    restrictions: number;
  };
  compatibilityReferences: InteroperabilityAdapterReference[];
  settlementReferences: InteroperabilityAdapterReference[];
  regulatoryReferences: InteroperabilityAdapterReference[];
  evidenceReferences: InteroperabilityAdapterReference[];
  reviewReferences: InteroperabilityAdapterReference[];
  sharingReferences: InteroperabilityAdapterReference[];
  auditReferences: InteroperabilityAdapterReference[];
  adapterRestrictions: InteroperabilityAdapterRestriction[];
  redactions: string[];
  blockedReasons: string[];
  canonicalEvents: Array<{ eventType: string; action: string; status: InteroperabilityAdapterStatus; resourceId: string; summary: string }>;
};

export async function fetchInteroperabilityAdapterReadiness(params?: {
  adapterType?: InteroperabilityAdapterType | "";
  status?: InteroperabilityAdapterStatus | "";
}): Promise<InteroperabilityAdapterReadiness[]> {
  const search = new URLSearchParams();
  if (params?.adapterType) search.set("adapterType", params.adapterType);
  if (params?.status) search.set("status", params.status);
  const suffix = search.toString() ? `?${search.toString()}` : "";
  const response = await apiFetch<{ ok: true; readiness: InteroperabilityAdapterReadiness[] }>(`/landlord/interoperability-adapters${suffix}`);
  return response.readiness;
}

export async function fetchInteroperabilityAdapterReadinessItem(adapterReadinessId: string): Promise<InteroperabilityAdapterReadiness> {
  const response = await apiFetch<{ ok: true; readiness: InteroperabilityAdapterReadiness }>(
    `/landlord/interoperability-adapters/${encodeURIComponent(adapterReadinessId)}`
  );
  return response.readiness;
}
