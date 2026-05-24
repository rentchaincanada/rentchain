import { apiFetch } from "./apiFetch";
import type { AdminReviewWorkspaceLink } from "./adminSecurityIncidentsApi";

export type GovernedReviewWorkspaceRecord = {
  workspaceId: string;
  workspaceType: string;
  title: string;
  summary: string;
  workflowFamily: string | null;
  severitySummary: string;
  reviewStateSummary: string;
  approvalExpectationSummary: string;
  relatedIncidentCount: number;
  relatedEscalationCount: number;
  relatedEvidenceCount: number;
  relatedNoteCount: number;
  appendEventCount: number;
  retentionClass: string;
  retentionReviewAt: string | null;
  lastAppendedAt: string;
  metadataOnly: true;
  visibilityClass: "admin_support_internal";
  tenantVisible: false;
  landlordVisible: false;
  appendOnly: true;
  mutationControlsEnabled: false;
  rawPayloadAccessEnabled: false;
};

export type GovernedReviewWorkspaceDetail = GovernedReviewWorkspaceRecord & {
  safeEvidenceRefs: Array<{
    referenceType: string;
    referenceId: string;
    label: string;
    internalReference: true;
    metadataOnly: true;
  }>;
  relatedWorkspaceLinks: AdminReviewWorkspaceLink[];
  appendEventSummaries: Array<{
    eventRefId: string;
    eventType: string;
    eventSummary: string;
    occurredAt: string;
    metadataOnly: true;
    visibilityClass: "admin_support_internal";
    tenantVisible: false;
    landlordVisible: false;
    appendOnly: true;
  }>;
  redactionSummary: string;
  payloadSafety: Record<string, string>;
  persistenceDecision: string;
};

export type GovernedReviewWorkspaceSummary = {
  total: number;
  metadataOnly: true;
  emptyState: string | null;
};

export async function fetchAdminReviewWorkspaces(params?: {
  workspaceType?: string | null;
  q?: string | null;
  limit?: number | null;
}) {
  const query = new URLSearchParams();
  if (params?.workspaceType) query.set("workspaceType", params.workspaceType);
  if (params?.q) query.set("q", params.q);
  if (params?.limit) query.set("limit", String(params.limit));
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiFetch<{
    ok: true;
    workspaces: GovernedReviewWorkspaceRecord[];
    summary: GovernedReviewWorkspaceSummary;
    schema: {
      metadataOnly: true;
      visibilityClass: "admin_support_internal";
      tenantVisible: false;
      landlordVisible: false;
      appendOnly: true;
      persistence: "read_only_if_present";
      mutationControlsEnabled: false;
      rawPayloadAccessEnabled: false;
      createRouteEnabled: false;
      updateRouteEnabled: false;
      deleteRouteEnabled: false;
    };
  }>(`/admin/review-workspaces${suffix}`);
}

export async function fetchAdminReviewWorkspaceDetail(workspaceId: string) {
  return apiFetch<{
    ok: true;
    workspace: GovernedReviewWorkspaceDetail;
  }>(`/admin/review-workspaces/${encodeURIComponent(workspaceId)}`);
}
