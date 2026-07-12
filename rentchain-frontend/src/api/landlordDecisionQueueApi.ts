import { apiFetch } from "./apiFetch";

export type LandlordDecisionQueueSeverity =
  | "critical"
  | "warning"
  | "needs_review"
  | "upcoming"
  | "informational";

export type LandlordDecisionQueueWorkspace =
  | "dashboard"
  | "operations"
  | "tenant"
  | "lease"
  | "property"
  | "maintenance"
  | "payments"
  | "notices"
  | "evidence_compliance";

export type LandlordDecisionQueueStatus =
  | "open"
  | "acknowledged"
  | "in_review"
  | "pending"
  | "blocked"
  | "approved"
  | "returned"
  | "deferred"
  | "resolved"
  | "dismissed";

export type LandlordDecisionQueueSourceType =
  | "renewal_notice_send_review"
  | "application_review"
  | "evidence_review"
  | "decision_inbox"
  | "lease_state_coherence"
  | "payment_obligation"
  | "payment_readiness"
  | "lease_lifecycle"
  | "maintenance_readiness"
  | "property_action_request"
  | "message_thread"
  | "message_unread_priority"
  | "message_notice_relevance"
  | "message_maintenance_follow_up"
  | "message_support_escalation"
  | "unified_inbox_event";

export type LandlordDecisionQueueAssignment = {
  assignedToUserId: string | null;
  assignedToEmail: string | null;
  assignmentLabel: string | null;
};

export type LandlordDecisionQueueItem = {
  id: string;
  persistence?: "derived" | "persisted";
  sourceType: string;
  sourceId: string;
  sourceRoute?: string | null;
  propertyId?: string | null;
  unitId?: string | null;
  tenantId?: string | null;
  leaseId?: string | null;
  maintenanceRequestId?: string | null;
  noticeId?: string | null;
  workspace: LandlordDecisionQueueWorkspace;
  severity: LandlordDecisionQueueSeverity;
  title: string;
  description: string;
  recommendedActionLabel: string;
  recommendedActionHref: string;
  dueAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  status: LandlordDecisionQueueStatus;
  assignment?: LandlordDecisionQueueAssignment | null;
  createdBy?: string | null;
  updatedBy?: string | null;
  lastActionAt?: string | null;
  lastActionBy?: string | null;
  sourceSnapshot?: Record<string, unknown> | null;
  auditEventIds?: string[];
  metadata?: Record<string, unknown> | null;
  dedupeKey: string;
  sortKey: string;
  priorityRank: number;
};

export type LandlordDecisionQueueSummary = {
  total: number;
  critical: number;
  warning: number;
  needsReview: number;
  upcoming: number;
  informational: number;
  open: number;
  blocked: number;
};

export type LandlordDecisionQueueResponse = {
  ok: true;
  version: "landlord_decision_queue_v1";
  landlordId: string;
  generatedAt: string;
  items: LandlordDecisionQueueItem[];
  summary: LandlordDecisionQueueSummary;
  total: number;
  limit: number;
  filters: {
    severity: LandlordDecisionQueueSeverity | null;
    workspace: LandlordDecisionQueueWorkspace | null;
    status: LandlordDecisionQueueStatus | "open_state" | null;
    sourceType?: LandlordDecisionQueueSourceType | null;
    sourceId?: string | null;
    sourceRoute?: string | null;
  };
};

export async function fetchLandlordDecisionQueue(params?: {
  limit?: number;
  status?: LandlordDecisionQueueStatus | "open_state";
  workspace?: LandlordDecisionQueueWorkspace;
  severity?: LandlordDecisionQueueSeverity;
  sourceType?: LandlordDecisionQueueSourceType;
  sourceId?: string;
  sourceRoute?: string;
}): Promise<LandlordDecisionQueueResponse> {
  const search = new URLSearchParams();
  if (params?.limit) search.set("limit", String(params.limit));
  if (params?.status) search.set("status", params.status);
  if (params?.workspace) search.set("workspace", params.workspace);
  if (params?.severity) search.set("severity", params.severity);
  if (params?.sourceType) search.set("sourceType", params.sourceType);
  if (params?.sourceId) search.set("sourceId", params.sourceId);
  if (params?.sourceRoute) search.set("sourceRoute", params.sourceRoute);
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<LandlordDecisionQueueResponse>(`/landlord/decision-queue${suffix}`);
}

export type CreateLandlordDecisionQueueItemPayload = {
  sourceType: LandlordDecisionQueueSourceType;
  sourceId: string;
  sourceRoute?: string | null;
  workspace: LandlordDecisionQueueWorkspace;
  severity: LandlordDecisionQueueSeverity;
  title: string;
  description: string;
  recommendedActionLabel: string;
  recommendedActionHref: string;
  dueAt?: string | null;
  status?: LandlordDecisionQueueStatus | null;
  assignment?: LandlordDecisionQueueAssignment | null;
  sourceSnapshot?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  dedupeKey?: string | null;
  propertyId?: string | null;
  unitId?: string | null;
  tenantId?: string | null;
  leaseId?: string | null;
  maintenanceRequestId?: string | null;
  noticeId?: string | null;
};

export type LandlordDecisionQueueMutationResponse = {
  ok: true;
  item: LandlordDecisionQueueItem;
  auditEventId?: string | null;
  created?: boolean;
};

export function createLandlordDecisionQueueItem(payload: CreateLandlordDecisionQueueItemPayload) {
  return apiFetch<LandlordDecisionQueueMutationResponse>("/landlord/decision-queue/items", {
    method: "POST",
    body: payload,
  });
}

export function updateLandlordDecisionQueueItem(
  decisionItemId: string,
  payload: {
    action?: string | null;
    status?: LandlordDecisionQueueStatus | null;
    assignment?: LandlordDecisionQueueAssignment | null;
    clearAssignment?: boolean;
    dueAt?: string | null;
    clearDueAt?: boolean;
    metadata?: Record<string, unknown> | null;
  }
) {
  return apiFetch<LandlordDecisionQueueMutationResponse>(
    `/landlord/decision-queue/items/${encodeURIComponent(decisionItemId)}`,
    {
      method: "PATCH",
      body: payload,
    }
  );
}
