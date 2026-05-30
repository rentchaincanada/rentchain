import { tenantApiFetch } from "./tenantApiFetch";
import type { TenantSafeProjectionMetadata } from "./tenantPortal";

export type TenantCommunicationType = "notice" | "message" | "maintenance_update" | "screening_update" | "system";
export type TenantCommunicationPriority = "low" | "normal" | "high";

export type TenantCommunicationItem = {
  id: string;
  type: TenantCommunicationType;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  priority: TenantCommunicationPriority;
  fromLabel: "Landlord" | "RentChain" | "Maintenance Team";
  relatedEntityType: "notice" | "maintenance" | "message" | "screening" | null;
  relatedEntityId: string | null;
};

export type TenantCommunicationSummary = {
  ok: boolean;
  unreadMessages: number;
  unreadNotices: number;
  unreadMaintenanceUpdates: number;
  unreadScreeningUpdates?: number;
  unreadTotal: number;
  latestMessagePreview?: string | null;
  latestMessageAt?: string | null;
};

export type TenantThreadMessage = {
  id: string;
  senderRole: "tenant" | "landlord";
  body: string;
  createdAt: string | null;
  createdAtMs: number | null;
};

export type TenantCommunicationsWorkspace = TenantSafeProjectionMetadata & {
  canSend: boolean;
  canSendReason: string | null;
  thread: {
    id: string;
    landlordLabel: string;
    propertyId: string | null;
    unitId: string | null;
    unreadCount: number;
    lastMessageAt: string | null;
    messages: TenantThreadMessage[];
  } | null;
};

export async function getTenantMessages() {
  return tenantApiFetch<{ ok: boolean; items: TenantCommunicationItem[]; unreadCount: number }>(
    "/tenant/messages"
  );
}

export async function getTenantNoticesCenter() {
  return tenantApiFetch<{ ok: boolean; items: TenantCommunicationItem[]; unreadCount: number }>(
    "/tenant/notices"
  );
}

export async function markTenantMessageRead(messageId: string) {
  return tenantApiFetch<{ ok: boolean }>(`/tenant/messages/${encodeURIComponent(messageId)}/read`, {
    method: "POST",
  });
}

export async function markTenantNoticeRead(noticeId: string) {
  return tenantApiFetch<{ ok: boolean }>(`/tenant/notices/${encodeURIComponent(noticeId)}/read`, {
    method: "POST",
  });
}

export async function markTenantMessagesReadAll() {
  return tenantApiFetch<{ ok: boolean; updated: number }>("/tenant/messages/read-all", {
    method: "POST",
  });
}

export async function markTenantMaintenanceUpdateRead(requestId: string) {
  return tenantApiFetch<{ ok: boolean }>(`/tenant/messages/maintenance/${encodeURIComponent(requestId)}/read`, {
    method: "POST",
  });
}

export async function markTenantScreeningUpdateRead(requestId: string) {
  return tenantApiFetch<{ ok: boolean }>(`/tenant/messages/screening/${encodeURIComponent(requestId)}/read`, {
    method: "POST",
  });
}

export async function getTenantCommunicationSummary() {
  return tenantApiFetch<TenantCommunicationSummary>("/tenant/communication/summary");
}

export async function getTenantCommunicationsWorkspace(): Promise<TenantCommunicationsWorkspace> {
  const res = await tenantApiFetch<{ ok: boolean; data: TenantCommunicationsWorkspace }>("/tenant/communications");
  return res.data;
}

export async function sendTenantCommunicationMessage(body: string): Promise<TenantThreadMessage> {
  const res = await tenantApiFetch<{ ok: boolean; data: TenantThreadMessage }>("/tenant/communications/messages", {
    method: "POST",
    body: { body },
  });
  return res.data;
}

export async function markTenantCommunicationsRead(): Promise<void> {
  await tenantApiFetch<{ ok: boolean }>("/tenant/communications/read", {
    method: "POST",
  });
}

