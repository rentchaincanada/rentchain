import { tenantApiFetch } from "./tenantApiFetch";
import type { NotificationChannelPreferences } from "../pages/notificationChannelRouting";

export type TenantNotificationPreferences = NotificationChannelPreferences & {
  updatedAt: number | null;
};

export async function getTenantNotificationPreferences(): Promise<TenantNotificationPreferences> {
  const res = await tenantApiFetch<{ ok: boolean; data: TenantNotificationPreferences }>("/tenant/notification-preferences");
  return res.data;
}

export async function updateTenantNotificationPreferences(input: {
  inApp: Partial<NotificationChannelPreferences["inApp"]>;
}): Promise<TenantNotificationPreferences> {
  const res = await tenantApiFetch<{ ok: boolean; data: TenantNotificationPreferences }>("/tenant/notification-preferences", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return res.data;
}
