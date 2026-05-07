import { apiFetch } from "./apiFetch";

export type ObservabilityIncidentReadinessStatus =
  | "ready_for_review"
  | "partially_ready"
  | "review_required"
  | "blocked"
  | "unknown";

export type ObservabilityIncidentReferenceType =
  | "observability"
  | "incident"
  | "outage"
  | "recovery"
  | "escalation"
  | "post_incident_review"
  | "sla"
  | "alert"
  | "release"
  | "public_exposure"
  | "evidence"
  | "review"
  | "audit";

export type ObservabilityIncidentReferenceStatus = "verified" | "partially_verified" | "blocked" | "unavailable";

export type ObservabilityIncidentReference = {
  referenceId: string;
  referenceType: ObservabilityIncidentReferenceType;
  status: ObservabilityIncidentReferenceStatus;
  label: string;
  description: string;
  reviewRequired: true;
  lineageReferences: string[];
  destination: string | null;
  redacted: boolean;
  redactionReason: string | null;
  blockedReason: string | null;
};

export type ObservabilityIncidentRestriction = {
  restrictionId: string;
  restrictionType: ObservabilityIncidentReferenceType | "external_monitoring" | "autonomous_remediation";
  status: "visible" | "blocked" | "review_required";
  label: string;
  description: string;
  blockedReason: string | null;
};

export type ObservabilityIncidentReadinessProfile = {
  observabilityIncidentReadinessId: string;
  status: ObservabilityIncidentReadinessStatus;
  manualReviewRequired: true;
  externalMonitoringIntegrationEnabled: false;
  autonomousRemediationEnabled: false;
  alertSendingEnabled: false;
  productionMutationEnabled: false;
  sensitiveTelemetryExposed: false;
  generatedAt: string;
  summary: {
    totalReferences: number;
    verifiedReferences: number;
    partiallyVerifiedReferences: number;
    blockedReferences: number;
    unavailableReferences: number;
    restrictions: number;
  };
  observabilityReferences: ObservabilityIncidentReference[];
  incidentReferences: ObservabilityIncidentReference[];
  outageReferences: ObservabilityIncidentReference[];
  recoveryReferences: ObservabilityIncidentReference[];
  escalationReferences: ObservabilityIncidentReference[];
  postIncidentReviewReferences: ObservabilityIncidentReference[];
  slaReferences: ObservabilityIncidentReference[];
  alertReferences: ObservabilityIncidentReference[];
  releaseReferences: ObservabilityIncidentReference[];
  publicExposureReferences: ObservabilityIncidentReference[];
  evidenceReferences: ObservabilityIncidentReference[];
  reviewReferences: ObservabilityIncidentReference[];
  auditReferences: ObservabilityIncidentReference[];
  observabilityIncidentRestrictions: ObservabilityIncidentRestriction[];
  redactions: string[];
  blockedReasons: string[];
  canonicalEvents: Array<{ eventType: string; action: string; status: ObservabilityIncidentReadinessStatus; resourceId: string; summary: string }>;
};

export async function fetchObservabilityIncidentReadinessProfiles(params?: {
  status?: ObservabilityIncidentReadinessStatus | "";
}): Promise<ObservabilityIncidentReadinessProfile[]> {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  const suffix = search.toString() ? `?${search.toString()}` : "";
  const response = await apiFetch<{ ok: true; profiles: ObservabilityIncidentReadinessProfile[] }>(
    `/admin/observability-incident-readiness${suffix}`
  );
  return response.profiles;
}

export async function fetchObservabilityIncidentReadinessProfile(
  observabilityIncidentReadinessId: string
): Promise<ObservabilityIncidentReadinessProfile> {
  const response = await apiFetch<{ ok: true; profile: ObservabilityIncidentReadinessProfile }>(
    `/admin/observability-incident-readiness/${encodeURIComponent(observabilityIncidentReadinessId)}`
  );
  return response.profile;
}
