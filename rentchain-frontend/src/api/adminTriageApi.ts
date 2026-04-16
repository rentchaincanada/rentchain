import { apiFetch } from "./apiFetch";

export type AdminTriageItemV1 = {
  id: string;
  version: "v1";
  category:
    | "screening_reconciliation"
    | "policy_review"
    | "automation_exception"
    | "maintenance_friction"
    | "workflow_stall"
    | "system_attention";
  severity: "low" | "medium" | "high" | "critical";
  resource: {
    type: string;
    id: string;
    title?: string | null;
    subtitle?: string | null;
    status?: string | null;
  };
  reason: {
    code: string;
    summary: string;
    details?: string | null;
  };
  signals: {
    reconciliationStatus?: string | null;
    lifecycleState?: string | null;
    policyOutcome?: string | null;
    automationAction?: string | null;
    automationExecuted?: boolean | null;
    blockedCount?: number | null;
    reopenCount?: number | null;
    inactivityMs?: number | null;
  };
  timestamps: {
    surfacedAt: string;
    firstSeenAt?: string | null;
    lastSeenAt?: string | null;
  };
  navigation: {
    supportConsolePath?: string | null;
  };
  resolution?: {
    status: "open" | "acknowledged" | "in_progress" | "resolved" | "dismissed";
    updatedAt: string;
  } | null;
  tags?: string[];
};

export type AdminTriageResponse = {
  items: AdminTriageItemV1[];
  nextCursor?: string;
};

export async function fetchAdminTriageQueue(params?: {
  category?: string | null;
  severity?: string | null;
  resourceType?: string | null;
  limit?: number | null;
  cursor?: string | null;
  includeLow?: boolean | null;
}): Promise<AdminTriageResponse> {
  const search = new URLSearchParams();
  if (params?.category) search.set("category", params.category);
  if (params?.severity) search.set("severity", params.severity);
  if (params?.resourceType) search.set("resourceType", params.resourceType);
  if (typeof params?.limit === "number") search.set("limit", String(params.limit));
  if (params?.cursor) search.set("cursor", params.cursor);
  if (typeof params?.includeLow === "boolean") search.set("includeLow", String(params.includeLow));
  const query = search.toString();
  return await apiFetch<AdminTriageResponse>(`/admin/triage${query ? `?${query}` : ""}`);
}
