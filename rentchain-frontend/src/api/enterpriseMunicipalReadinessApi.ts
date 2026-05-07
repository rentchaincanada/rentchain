import { apiFetch } from "./apiFetch";

export type EnterpriseMunicipalOrganizationType =
  | "municipality"
  | "affordable_housing_operator"
  | "institutional_landlord"
  | "enterprise_operator"
  | "government_program";
export type EnterpriseMunicipalReadinessStatus = "ready_for_review" | "partially_ready" | "review_required" | "blocked" | "unknown";
export type EnterpriseMunicipalReferenceType =
  | "institutional"
  | "municipal"
  | "portfolio_governance"
  | "regulatory"
  | "operational_risk"
  | "review"
  | "evidence"
  | "audit";
export type EnterpriseMunicipalReferenceStatus = "verified" | "partially_verified" | "blocked" | "unavailable";

export type EnterpriseMunicipalReference = {
  referenceId: string;
  referenceType: EnterpriseMunicipalReferenceType;
  status: EnterpriseMunicipalReferenceStatus;
  label: string;
  description: string;
  reviewRequired: true;
  lineageReferences: string[];
  destination: string | null;
  redacted: boolean;
  redactionReason: string | null;
  blockedReason: string | null;
};

export type EnterpriseMunicipalRestriction = {
  restrictionId: string;
  restrictionType:
    | EnterpriseMunicipalReferenceType
    | "government_execution"
    | "enterprise_execution"
    | "cmhc_submission"
    | "public_sector_export"
    | "portfolio_exposure";
  status: "visible" | "blocked" | "review_required";
  label: string;
  description: string;
  blockedReason: string | null;
};

export type EnterpriseMunicipalReadinessProfile = {
  enterpriseMunicipalReadinessId: string;
  organizationType: EnterpriseMunicipalOrganizationType;
  status: EnterpriseMunicipalReadinessStatus;
  manualApprovalRequired: true;
  autonomousGovernmentExecutionEnabled: false;
  autonomousEnterpriseExecutionEnabled: false;
  generatedAt: string;
  summary: {
    totalReferences: number;
    verifiedReferences: number;
    partiallyVerifiedReferences: number;
    blockedReferences: number;
    unavailableReferences: number;
    restrictions: number;
  };
  institutionalReferences: EnterpriseMunicipalReference[];
  portfolioGovernanceReferences: EnterpriseMunicipalReference[];
  municipalReadinessReferences: EnterpriseMunicipalReference[];
  regulatoryReferences: EnterpriseMunicipalReference[];
  operationalRiskReferences: EnterpriseMunicipalReference[];
  reviewReferences: EnterpriseMunicipalReference[];
  evidenceReferences: EnterpriseMunicipalReference[];
  auditReferences: EnterpriseMunicipalReference[];
  enterpriseRestrictions: EnterpriseMunicipalRestriction[];
  redactions: string[];
  blockedReasons: string[];
  canonicalEvents: Array<{ eventType: string; action: string; status: EnterpriseMunicipalReadinessStatus; resourceId: string; summary: string }>;
};

export async function fetchEnterpriseMunicipalReadinessProfiles(params?: {
  organizationType?: EnterpriseMunicipalOrganizationType | "";
  status?: EnterpriseMunicipalReadinessStatus | "";
}): Promise<EnterpriseMunicipalReadinessProfile[]> {
  const search = new URLSearchParams();
  if (params?.organizationType) search.set("organizationType", params.organizationType);
  if (params?.status) search.set("status", params.status);
  const suffix = search.toString() ? `?${search.toString()}` : "";
  const response = await apiFetch<{ ok: true; profiles: EnterpriseMunicipalReadinessProfile[] }>(`/admin/enterprise-municipal-readiness${suffix}`);
  return response.profiles;
}

export async function fetchEnterpriseMunicipalReadinessProfile(enterpriseMunicipalReadinessId: string): Promise<EnterpriseMunicipalReadinessProfile> {
  const response = await apiFetch<{ ok: true; profile: EnterpriseMunicipalReadinessProfile }>(
    `/admin/enterprise-municipal-readiness/${encodeURIComponent(enterpriseMunicipalReadinessId)}`
  );
  return response.profile;
}
