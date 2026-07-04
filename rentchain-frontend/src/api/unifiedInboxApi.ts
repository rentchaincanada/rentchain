import { apiFetch } from "./apiFetch";
import { tenantApiFetch } from "./tenantApiFetch";

export type UnifiedInboxRole = "tenant" | "landlord" | "contractor";

export type UnifiedInboxPriority = "critical" | "high" | "normal" | "low";

export type UnifiedInboxStatus = "unread" | "read" | "archived" | "muted" | "resolved";

export type UnifiedInboxSourceKind =
  | "tenant.message"
  | "tenant.maintenance"
  | "tenant.screening"
  | "tenant.lease"
  | "tenant.application"
  | "tenant.notice"
  | "tenant.viewing"
  | "landlord.application"
  | "landlord.screening"
  | "landlord.lease"
  | "landlord.maintenance"
  | "landlord.message"
  | "landlord.notice"
  | "landlord.viewing"
  | "landlord.work_order"
  | "contractor.work_order"
  | "contractor.message";

export type UnifiedInboxRecord = {
  id: string;
  sourceKind: UnifiedInboxSourceKind;
  audienceRole: UnifiedInboxRole;
  title: string;
  body: string;
  priority: UnifiedInboxPriority;
  status: UnifiedInboxStatus;
  occurredAt: string;
  readAt: string | null;
};

export type UnifiedInboxResponse = {
  ok: true;
  role: UnifiedInboxRole;
  items: UnifiedInboxRecord[];
  records: UnifiedInboxRecord[];
  total: number;
  limit: number;
  offset: number;
};

export type UnifiedInboxReadResponse = {
  ok: true;
  record: UnifiedInboxRecord;
};

export async function fetchUnifiedInbox(role: UnifiedInboxRole): Promise<UnifiedInboxResponse> {
  if (role === "tenant") {
    return tenantApiFetch<UnifiedInboxResponse>("/tenant/inbox");
  }
  if (role === "contractor") {
    return apiFetch<UnifiedInboxResponse>("/contractor/inbox");
  }
  return apiFetch<UnifiedInboxResponse>("/landlord/inbox");
}

export async function markUnifiedInboxRecordRead(
  role: UnifiedInboxRole,
  recordId: string
): Promise<UnifiedInboxReadResponse> {
  if (role !== "landlord") {
    throw new Error("Read-state persistence is not available for this inbox role.");
  }
  return apiFetch<UnifiedInboxReadResponse>(`/landlord/inbox/${encodeURIComponent(recordId)}/read`, {
    method: "POST",
  });
}
