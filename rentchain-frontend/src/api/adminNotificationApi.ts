import { apiFetch } from "./apiFetch";

export type AdminNotificationV1 = {
  version: "v1";
  id: string;
  type: "alert" | "sla_escalation" | "triage_item" | "portfolio_score_change";
  resource: {
    type: string;
    id: string;
    portfolioId?: string | null;
  };
  summary: {
    title: string;
    message: string;
  };
  severity?: "low" | "medium" | "high" | "critical";
  watched?: boolean;
  state: {
    status: "unread" | "read";
    readAt?: string | null;
  };
  createdAt: string;
  updatedAt: string;
  navigation: {
    supportConsolePath?: string | null;
    triagePath?: string | null;
    portfolioScorePath?: string | null;
  };
};

export async function fetchNotifications(params?: {
  unreadOnly?: boolean | null;
  watchedOnly?: boolean | null;
  limit?: number | null;
  cursor?: string | null;
}): Promise<{ notifications: AdminNotificationV1[]; nextCursor?: string }> {
  const search = new URLSearchParams();
  if (typeof params?.unreadOnly === "boolean") search.set("unreadOnly", String(params.unreadOnly));
  if (typeof params?.watchedOnly === "boolean") search.set("watchedOnly", String(params.watchedOnly));
  if (typeof params?.limit === "number") search.set("limit", String(params.limit));
  if (params?.cursor) search.set("cursor", params.cursor);
  const query = search.toString();
  return await apiFetch(`/admin/notifications${query ? `?${query}` : ""}`);
}

export async function markNotificationRead(notificationId: string, payload: { read: boolean }) {
  return await apiFetch(`/admin/notifications/${encodeURIComponent(notificationId)}/read`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
