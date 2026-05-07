import { apiFetch } from "./apiFetch";

export type EcosystemCoordinationStatus = "stable" | "attention_required" | "review_required" | "blocked" | "unknown";
export type EcosystemCoordinationReferenceType =
  | "participant"
  | "trust"
  | "onboarding"
  | "risk"
  | "integration"
  | "settlement"
  | "regulatory"
  | "observability"
  | "governance"
  | "evidence"
  | "review"
  | "audit";
export type EcosystemCoordinationReferenceStatus = "verified" | "partially_verified" | "blocked" | "unavailable";

export type EcosystemCoordinationReference = {
  referenceId: string;
  referenceType: EcosystemCoordinationReferenceType;
  status: EcosystemCoordinationReferenceStatus;
  label: string;
  description: string;
  reviewRequired: true;
  lineageReferences: string[];
  destination: string | null;
  redacted: boolean;
  redactionReason: string | null;
  blockedReason: string | null;
};

export type EcosystemRestriction = {
  restrictionId: string;
  restrictionType: EcosystemCoordinationReferenceType | "orchestration" | "external_execution" | "public_networking";
  status: "visible" | "blocked" | "review_required";
  label: string;
  description: string;
  blockedReason: string | null;
};

export type EcosystemCoordinationSnapshot = {
  ecosystemCoordinationId: string;
  status: EcosystemCoordinationStatus;
  manualReviewRequired: true;
  autonomousCoordinationEnabled: false;
  externalExecutionEnabled: false;
  generatedAt: string;
  summary: {
    totalReferences: number;
    verifiedReferences: number;
    partiallyVerifiedReferences: number;
    blockedReferences: number;
    unavailableReferences: number;
    restrictions: number;
  };
  participantReferences: EcosystemCoordinationReference[];
  trustReferences: EcosystemCoordinationReference[];
  onboardingReferences: EcosystemCoordinationReference[];
  riskReferences: EcosystemCoordinationReference[];
  integrationReferences: EcosystemCoordinationReference[];
  settlementReferences: EcosystemCoordinationReference[];
  regulatoryReferences: EcosystemCoordinationReference[];
  observabilityReferences: EcosystemCoordinationReference[];
  governanceReferences: EcosystemCoordinationReference[];
  reviewReferences: EcosystemCoordinationReference[];
  evidenceReferences: EcosystemCoordinationReference[];
  auditReferences: EcosystemCoordinationReference[];
  ecosystemRestrictions: EcosystemRestriction[];
  redactions: string[];
  blockedReasons: string[];
  canonicalEvents: Array<{ eventType: string; action: string; status: EcosystemCoordinationStatus; resourceId: string; summary: string }>;
};

export async function fetchEcosystemCoordinationSnapshots(params?: {
  status?: EcosystemCoordinationStatus | "";
}): Promise<EcosystemCoordinationSnapshot[]> {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  const suffix = search.toString() ? `?${search.toString()}` : "";
  const response = await apiFetch<{ ok: true; snapshots: EcosystemCoordinationSnapshot[] }>(`/admin/ecosystem-coordination${suffix}`);
  return response.snapshots;
}

export async function fetchEcosystemCoordinationSnapshot(ecosystemCoordinationId: string): Promise<EcosystemCoordinationSnapshot> {
  const response = await apiFetch<{ ok: true; snapshot: EcosystemCoordinationSnapshot }>(
    `/admin/ecosystem-coordination/${encodeURIComponent(ecosystemCoordinationId)}`
  );
  return response.snapshot;
}
