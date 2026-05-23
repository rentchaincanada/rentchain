import { apiFetch } from "./apiFetch";

export type AdminSupportEscalationRecord = {
  escalationReviewVersion: string;
  escalationId: string;
  category: string;
  severity: string;
  state: string;
  approvalExpectation: string;
  title: string;
  summary: string;
  createdAt: string;
  lastUpdatedAt: string;
  actorSummary: {
    role: string | null;
    displayName: string | null;
    supportAttribution: boolean;
    rawActorIdsIncluded: false;
  } | null;
  safeEvidenceRefs: Array<{
    referenceType: string;
    referenceId: string;
    label: string;
    internalReference: true;
    metadataOnly: true;
  }>;
  historyCount: number;
  noteCount: number;
  metadataOnly: true;
  visibilityClass: "admin_support_internal";
  tenantVisible: false;
  landlordVisible: false;
};

export type AdminSupportEscalationDetail = AdminSupportEscalationRecord & {
  historyEntries: Array<Record<string, unknown>>;
  reviewNotes: Array<Record<string, unknown>>;
  redactionSummary: string;
  prohibitedActions: string[];
  emptyState: boolean;
};

export type AdminSupportEscalationSummary = {
  total: number;
  highOrCritical: number;
  awaitingApproval: number;
  notes: number;
  metadataOnly: true;
  emptyState: string | null;
};

export async function fetchAdminSupportEscalations(params?: {
  category?: string | null;
  severity?: string | null;
  state?: string | null;
  approvalExpectation?: string | null;
  q?: string | null;
  limit?: number | null;
}) {
  const query = new URLSearchParams();
  if (params?.category) query.set("category", params.category);
  if (params?.severity) query.set("severity", params.severity);
  if (params?.state) query.set("state", params.state);
  if (params?.approvalExpectation) query.set("approvalExpectation", params.approvalExpectation);
  if (params?.q) query.set("q", params.q);
  if (params?.limit) query.set("limit", String(params.limit));
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiFetch<{
    ok: true;
    escalations: AdminSupportEscalationRecord[];
    summary: AdminSupportEscalationSummary;
    schema: {
      metadataOnly: true;
      visibilityClass: "admin_support_internal";
      tenantVisible: false;
      landlordVisible: false;
      persistence: "read_only_if_present";
      mutationControlsEnabled: false;
    };
  }>(`/admin/support/escalations${suffix}`);
}

export async function fetchAdminSupportEscalationDetail(escalationId: string) {
  return apiFetch<{
    ok: true;
    escalation: AdminSupportEscalationDetail;
  }>(`/admin/support/escalations/${encodeURIComponent(escalationId)}`);
}
