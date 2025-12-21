import { apiJson } from "../lib/apiClient";

export type AdminScreening = {
  id: string;
  applicationId?: string;
  landlordId?: string;
  status: string;
  providerName?: string;
  providerReferenceId?: string;
  createdAt: string;
  paidAt?: string;
  completedAt?: string;
  deleteAfterAt?: string;
  failureReason?: string;
  lastWebhookEventId?: string;
  lastProviderDurationMs?: number;
};

export async function listAdminScreenings(): Promise<AdminScreening[]> {
  const data = await apiJson<{ screenings: AdminScreening[] }>("/admin/screenings");
  return data.screenings || [];
}

export async function retryScreening(id: string) {
  return apiJson<{ screeningRequest: any }>(
    `/admin/screenings/${encodeURIComponent(id)}/retry`,
    { method: "POST" }
  );
}

export async function resendScreeningEmail(id: string) {
  return apiJson<{ success: boolean }>(
    `/admin/screenings/${encodeURIComponent(id)}/resend-email`,
    { method: "POST" }
  );
}

export async function purgeExpiredScreenings() {
  return apiJson<{ deletedCount: number }>(`/admin/screenings/expired`, {
    method: "DELETE",
  });
}
