import { apiFetch } from "./apiFetch";

export type SlaEvaluationV1 = {
  version: "v1";
  resource: {
    type: string;
    id: string;
  };
  context: {
    triageCategory?: string | null;
    triageSeverity?: string | null;
    resolutionStatus?: string | null;
    assignmentOwnerId?: string | null;
    assignmentOwnerLabel?: string | null;
  };
  age: {
    firstSeenAt?: string | null;
    lastSeenAt?: string | null;
    ageMs: number;
    ageHours: number;
  };
  sla: {
    stage: "fresh" | "aging" | "due_soon" | "overdue" | "escalated";
    escalationLevel: "none" | "low" | "medium" | "high" | "critical";
    thresholdHours: {
      aging: number;
      dueSoon: number;
      overdue: number;
      escalated: number;
    };
  };
  reason: {
    code: string;
    summary: string;
    details?: string | null;
  };
  evaluatedAt: string;
};

export async function fetchSlaItems(params?: {
  resourceType?: string | null;
  resourceId?: string | null;
  stage?: string | null;
  escalationLevel?: string | null;
  limit?: number | null;
  cursor?: string | null;
}): Promise<{ items: SlaEvaluationV1[]; nextCursor?: string }> {
  const search = new URLSearchParams();
  if (params?.resourceType) search.set("resourceType", params.resourceType);
  if (params?.resourceId) search.set("resourceId", params.resourceId);
  if (params?.stage) search.set("stage", params.stage);
  if (params?.escalationLevel) search.set("escalationLevel", params.escalationLevel);
  if (typeof params?.limit === "number") search.set("limit", String(params.limit));
  if (params?.cursor) search.set("cursor", params.cursor);
  const query = search.toString();
  return await apiFetch(`/admin/sla${query ? `?${query}` : ""}`);
}
