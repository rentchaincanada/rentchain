import { tenantApiFetch } from "./tenantApiFetch";

export type TenantCommunicationType = "notice" | "message" | "maintenance_update" | "system";
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
  relatedEntityType: "notice" | "maintenance" | "message" | null;
  relatedEntityId: string | null;
};

export type TenantCommunicationSummary = {
  ok: boolean;
  unreadMessages: number;
  unreadNotices: number;
  unreadMaintenanceUpdates: number;
  unreadTotal: number;
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

export async function getTenantCommunicationSummary() {
  return tenantApiFetch<TenantCommunicationSummary>("/tenant/communication/summary");
}
