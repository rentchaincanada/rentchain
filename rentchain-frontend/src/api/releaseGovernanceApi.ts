import { apiFetch } from "./apiFetch";

export type ReleaseGovernanceStatus = "ready_for_review" | "partially_ready" | "review_required" | "blocked" | "unknown";
export type ReleaseReferenceType = "release" | "deployment" | "rollback" | "qa" | "operational_risk" | "evidence" | "review" | "audit";
export type ReleaseReferenceStatus = "verified" | "partially_verified" | "blocked" | "unavailable";

export type ReleaseReference = {
  referenceId: string;
  referenceType: ReleaseReferenceType;
  status: ReleaseReferenceStatus;
  label: string;
  description: string;
  reviewRequired: true;
  lineageReferences: string[];
  destination: string | null;
  redacted: boolean;
  redactionReason: string | null;
  blockedReason: string | null;
};

export type ReleaseRestriction = {
  restrictionId: string;
  restrictionType: ReleaseReferenceType | "public_exposure" | "security";
  status: "visible" | "blocked" | "review_required";
  label: string;
  description: string;
  blockedReason: string | null;
};

export type ReleaseGovernanceProfile = {
  releaseGovernanceId: string;
  releaseVersion: string;
  status: ReleaseGovernanceStatus;
  manualApprovalRequired: true;
  autonomousDeploymentEnabled: false;
  autonomousRollbackEnabled: false;
  publicLaunchEnabled: false;
  generatedAt: string;
  summary: {
    totalReferences: number;
    verifiedReferences: number;
    partiallyVerifiedReferences: number;
    blockedReferences: number;
    unavailableReferences: number;
    restrictions: number;
  };
  releaseReferences: ReleaseReference[];
  deploymentReferences: ReleaseReference[];
  rollbackReferences: ReleaseReference[];
  qaReferences: ReleaseReference[];
  operationalRiskReferences: ReleaseReference[];
  reviewReferences: ReleaseReference[];
  evidenceReferences: ReleaseReference[];
  auditReferences: ReleaseReference[];
  releaseRestrictions: ReleaseRestriction[];
  redactions: string[];
  blockedReasons: string[];
  canonicalEvents: Array<{ eventType: string; action: string; status: ReleaseGovernanceStatus; resourceId: string; summary: string }>;
};

export async function fetchReleaseGovernanceProfiles(params?: {
  releaseVersion?: string;
  status?: ReleaseGovernanceStatus | "";
}): Promise<ReleaseGovernanceProfile[]> {
  const search = new URLSearchParams();
  if (params?.releaseVersion) search.set("releaseVersion", params.releaseVersion);
  if (params?.status) search.set("status", params.status);
  const suffix = search.toString() ? `?${search.toString()}` : "";
  const response = await apiFetch<{ ok: true; profiles: ReleaseGovernanceProfile[] }>(`/admin/release-governance${suffix}`);
  return response.profiles;
}

export async function fetchReleaseGovernanceProfile(releaseGovernanceId: string, releaseVersion?: string): Promise<ReleaseGovernanceProfile> {
  const search = new URLSearchParams();
  if (releaseVersion) search.set("releaseVersion", releaseVersion);
  const suffix = search.toString() ? `?${search.toString()}` : "";
  const response = await apiFetch<{ ok: true; profile: ReleaseGovernanceProfile }>(
    `/admin/release-governance/${encodeURIComponent(releaseGovernanceId)}${suffix}`
  );
  return response.profile;
}
