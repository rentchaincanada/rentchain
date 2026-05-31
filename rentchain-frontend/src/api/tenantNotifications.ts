import { tenantApiFetch } from "./tenantApiFetch";

export type TenantNotificationItem = {
  id: string;
  type: "application" | "identity" | "document" | "lease" | "maintenance" | "message" | "invite" | "system";
  title: string;
  summary: string;
  createdAt: string;
  status: "info" | "success" | "warning";
  relatedPath: string | null;
  sourceRefs?: Array<{
    sourceType: string;
    referenceKey: string;
    label: string;
  }>;
  read?: boolean;
  readAt?: number | null;
};

export async function getTenantNotifications(): Promise<TenantNotificationItem[]> {
  const res = await tenantApiFetch<{ ok: boolean; data: TenantNotificationItem[] }>("/tenant/notifications");
  return Array.isArray(res?.data) ? res.data : [];
}
