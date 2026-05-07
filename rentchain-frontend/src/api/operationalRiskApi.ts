import { apiFetch } from "./apiFetch";

export type OperationalRiskScope = "property" | "lease" | "participant" | "institution" | "workflow" | "onboarding" | "settlement" | "regulatory";
export type OperationalRiskStatus = "stable" | "attention_required" | "elevated" | "blocked" | "unknown";
export type OperationalRiskType =
  | "review_gap"
  | "evidence_gap"
  | "settlement_inconsistency"
  | "workflow_instability"
  | "delinquency_exposure"
  | "onboarding_blocker"
  | "regulatory_restriction"
  | "audit_gap"
  | "trust_restriction";
export type OperationalRiskReferenceStatus = "verified" | "partially_verified" | "blocked" | "unavailable";
export type OperationalRiskSeverity = "low" | "moderate" | "elevated" | "critical";

export type OperationalRiskReference = {
  riskReferenceId: string;
  riskType: OperationalRiskType;
  status: OperationalRiskReferenceStatus;
  severity: OperationalRiskSeverity;
  label: string;
  description: string;
  reviewRequired: true;
  lineageReferences: string[];
  destination: string | null;
  redacted: boolean;
  redactionReason: string | null;
  blockedReason: string | null;
};

export type OperationalRiskProfile = {
  operationalRiskId: string;
  riskScope: OperationalRiskScope;
  status: OperationalRiskStatus;
  manualReviewRequired: true;
  autonomousRiskActionsEnabled: false;
  publicRiskExposureEnabled: false;
  generatedAt: string;
  summary: {
    totalReferences: number;
    verifiedReferences: number;
    partiallyVerifiedReferences: number;
    blockedReferences: number;
    unavailableReferences: number;
    lowSeverityReferences: number;
    moderateSeverityReferences: number;
    elevatedSeverityReferences: number;
    criticalSeverityReferences: number;
  };
  riskReferences: OperationalRiskReference[];
  evidenceReferences: OperationalRiskReference[];
  reviewReferences: OperationalRiskReference[];
  settlementReferences: OperationalRiskReference[];
  regulatoryReferences: OperationalRiskReference[];
  onboardingReferences: OperationalRiskReference[];
  trustReferences: OperationalRiskReference[];
  workflowReferences: OperationalRiskReference[];
  delinquencyReferences: OperationalRiskReference[];
  auditReferences: OperationalRiskReference[];
  redactions: string[];
  blockedReasons: string[];
  canonicalEvents: Array<{ eventType: string; action: string; status: OperationalRiskStatus; resourceId: string; summary: string }>;
};

export async function fetchOperationalRiskProfiles(params?: {
  riskScope?: OperationalRiskScope | "";
  status?: OperationalRiskStatus | "";
  severity?: OperationalRiskSeverity | "";
}): Promise<OperationalRiskProfile[]> {
  const search = new URLSearchParams();
  if (params?.riskScope) search.set("riskScope", params.riskScope);
  if (params?.status) search.set("status", params.status);
  if (params?.severity) search.set("severity", params.severity);
  const suffix = search.toString() ? `?${search.toString()}` : "";
  const response = await apiFetch<{ ok: true; profiles: OperationalRiskProfile[] }>(`/landlord/operational-risk${suffix}`);
  return response.profiles;
}

export async function fetchOperationalRiskProfile(operationalRiskId: string): Promise<OperationalRiskProfile> {
  const response = await apiFetch<{ ok: true; profile: OperationalRiskProfile }>(`/landlord/operational-risk/${encodeURIComponent(operationalRiskId)}`);
  return response.profile;
}
