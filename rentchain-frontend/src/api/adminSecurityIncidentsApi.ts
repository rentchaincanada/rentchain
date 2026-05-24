import { apiFetch } from "./apiFetch";

export type AdminSecurityIncidentSeverity = "info" | "low" | "medium" | "high" | "critical";
export type AdminSecurityIncidentStatus = "open" | "reviewing" | "resolved" | "dismissed";

export type AdminSecurityIncidentRecord = {
  incidentReviewVersion: string;
  incidentId: string;
  category: string;
  severity: AdminSecurityIncidentSeverity;
  status: AdminSecurityIncidentStatus;
  title: string;
  summary: string;
  occurredAt: string;
  lastSeenAt: string;
  actorSummary: {
    role: string | null;
    supportAttribution: boolean;
    rawActorIdsIncluded: false;
  };
  targetSummary: {
    accountType: string | null;
    resourceType: string | null;
    landlordScoped: boolean;
    tenantScoped: boolean;
    rawTargetIdsIncluded: false;
  };
  workflowFamily: string | null;
  policyOutcomeSummary: string | null;
  sourceRoute: string | null;
  routeSource: string | null;
  metadataOnly: true;
  redactionSummary: string;
  recommendedReviewAction: string;
  safeEvidenceReferences: Array<{
    referenceType: string;
    referenceId: string;
    label: string;
    internalReference: true;
  }>;
};

export type AdminSecurityIncidentDetail = AdminSecurityIncidentRecord & {
  timeline: Array<{
    occurredAt: string;
    label: string;
    category: string;
    metadataOnly: true;
  }>;
  relatedEventSummaries: Array<{
    eventType: string;
    sourceCollection: string;
    occurredAt: string;
    summary: string;
    metadataOnly: true;
  }>;
  redactionNotes: string[];
  suggestedNextReviewStep: string;
  relatedWorkspaceLinks: AdminReviewWorkspaceLink[];
};

export type AdminReviewWorkspaceLink = {
  linkId: string;
  linkType: string;
  sourceSummary: {
    kind: string;
    label: string;
    category: string | null;
    severity: string | null;
    state: string | null;
    metadataOnly: true;
    rawIdsIncluded: false;
  };
  targetSummary: {
    kind: string;
    label: string;
    category: string | null;
    severity: string | null;
    state: string | null;
    metadataOnly: true;
    rawIdsIncluded: false;
  };
  workflowFamily: string | null;
  metadataOnly: true;
  visibilityClass: "admin_support_internal";
  tenantVisible: false;
  landlordVisible: false;
  appendCompatible: true;
  mutationControlsEnabled: false;
};

export async function fetchAdminSecurityIncidents(params?: {
  category?: string | null;
  severity?: string | null;
  status?: string | null;
  q?: string | null;
  limit?: number | null;
}) {
  const query = new URLSearchParams();
  if (params?.category) query.set("category", params.category);
  if (params?.severity) query.set("severity", params.severity);
  if (params?.status) query.set("status", params.status);
  if (params?.q) query.set("q", params.q);
  if (params?.limit) query.set("limit", String(params.limit));
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiFetch<{
    ok: true;
    incidents: AdminSecurityIncidentRecord[];
    summary: {
      total: number;
      open: number;
      reviewing: number;
      highOrCritical: number;
      metadataOnly: true;
    };
  }>(`/admin/security/incidents${suffix}`);
}

export async function fetchAdminSecurityIncidentDetail(incidentId: string) {
  return apiFetch<{
    ok: true;
    incident: AdminSecurityIncidentDetail;
  }>(`/admin/security/incidents/${encodeURIComponent(incidentId)}`);
}
