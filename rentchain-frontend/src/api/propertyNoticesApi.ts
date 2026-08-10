import { apiFetch } from "@/lib/apiClient";

export type NoticeRecipient = {
  tenantId: string;
  tenantDisplayName: string;
  unitIds: string[];
  unitLabels: string[];
  deliveryAvailability: "available" | "missing_email" | "duplicate_destination";
};

export type NoticeSummary = {
  id: string;
  propertyId: string;
  propertyLabel: string;
  subject: string;
  body?: string;
  status: "sending" | "completed" | "partially_failed" | "failed";
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  createdAtMs?: number;
};

export type NoticeDelivery = {
  id: string;
  tenantId: string;
  tenantDisplayName: string;
  unitIds: string[];
  unitLabels: string[];
  channel: "email";
  status: "pending" | "sent" | "failed" | "skipped";
  errorCategory?: string | null;
};

export async function fetchNoticeRecipients(propertyId: string, filters?: { unitIds?: string[]; tenantIds?: string[] }) {
  const params = new URLSearchParams({ propertyId });
  if (filters?.unitIds?.length) params.set("unitIds", filters.unitIds.join(","));
  if (filters?.tenantIds?.length) params.set("tenantIds", filters.tenantIds.join(","));
  return apiFetch(`/landlord/notices/recipients?${params.toString()}`) as Promise<{
    property: { id: string; label: string };
    recipients: NoticeRecipient[];
    counts: { total: number; available: number; skipped: number };
    maxRecipients: number;
  }>;
}

export async function fetchPropertyNotices(): Promise<NoticeSummary[]> {
  const response = await apiFetch("/landlord/notices?limit=50");
  return Array.isArray((response as any)?.notices) ? (response as any).notices : [];
}

export async function fetchPropertyNotice(id: string): Promise<{ notice: NoticeSummary; deliveries: NoticeDelivery[] }> {
  return apiFetch(`/landlord/notices/${encodeURIComponent(id)}`) as Promise<{ notice: NoticeSummary; deliveries: NoticeDelivery[] }>;
}

export async function sendPropertyNotice(input: {
  propertyId: string;
  subject: string;
  body: string;
  selectedUnitIds?: string[];
  selectedTenantIds?: string[];
  idempotencyKey: string;
}): Promise<{ created: boolean; notice: NoticeSummary }> {
  return apiFetch("/landlord/notices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }) as Promise<{ created: boolean; notice: NoticeSummary }>;
}
