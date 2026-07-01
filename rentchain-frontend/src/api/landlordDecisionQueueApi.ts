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

export type LandlordDecisionQueueStatus = "open" | "pending" | "blocked" | "resolved" | "dismissed";

export type LandlordDecisionQueueItem = {
  id: string;
  sourceType: string;
  sourceId: string;
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
  };
};

export async function fetchLandlordDecisionQueue(params?: {
  limit?: number;
  status?: LandlordDecisionQueueStatus | "open_state";
  workspace?: LandlordDecisionQueueWorkspace;
  severity?: LandlordDecisionQueueSeverity;
}): Promise<LandlordDecisionQueueResponse> {
  const search = new URLSearchParams();
  if (params?.limit) search.set("limit", String(params.limit));
  if (params?.status) search.set("status", params.status);
  if (params?.workspace) search.set("workspace", params.workspace);
  if (params?.severity) search.set("severity", params.severity);
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<LandlordDecisionQueueResponse>(`/landlord/decision-queue${suffix}`);
}
