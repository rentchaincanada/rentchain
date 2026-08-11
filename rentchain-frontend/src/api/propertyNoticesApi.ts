import { apiFetch } from "@/lib/apiClient";

export type NoticeRecipient = {
  tenantId: string;
  tenantDisplayName: string;
  unitIds: string[];
  unitLabels: string[];
  propertyIds: string[];
  propertyLabels: string[];
  units: Array<{ id: string; label: string; propertyId: string; propertyLabel: string }>;
  deliveryAvailability: "available" | "missing_email" | "duplicate_destination";
};

export type NoticeSummary = {
  id: string;
  propertyId?: string | null;
  propertyLabel?: string | null;
  propertyIds: string[];
  properties: Array<{ id: string; label: string }>;
  propertyCount: number;
  subject: string;
  body?: string;
  status: "sending" | "completed" | "partially_failed" | "failed";
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  createdAtMs?: number;
  completedAtMs?: number;
};

export type NoticeDelivery = {
  id: string;
  tenantId: string;
  tenantDisplayName: string;
  unitIds: string[];
  unitLabels: string[];
  propertyIds: string[];
  propertyLabels: string[];
  units: Array<{ id: string; label: string; propertyId: string; propertyLabel: string }>;
  channel: "email";
  status: "pending" | "sent" | "failed" | "skipped";
  errorCategory?: string | null;
};

export async function fetchNoticeRecipients(propertyIds: string[], filters?: { unitIds?: string[]; tenantIds?: string[] }) {
  const params = new URLSearchParams({ propertyIds: propertyIds.join(",") });
  if (filters?.unitIds?.length) params.set("unitIds", filters.unitIds.join(","));
  if (filters?.tenantIds?.length) params.set("tenantIds", filters.tenantIds.join(","));
  return apiFetch(`/landlord/notices/recipients?${params.toString()}`) as Promise<{
    properties: Array<{ id: string; label: string }>;
    propertyBreakdown: Array<{ id: string; label: string; recipientCount: number }>;
    recipients: NoticeRecipient[];
    counts: { total: number; available: number; skipped: number };
    maxRecipients: number;
  }>;
}

export async function fetchPropertyNotices(): Promise<NoticeSummary[]> {
  const response = await apiFetch("/landlord/notices?limit=50") as { notices?: NoticeSummary[] };
  return Array.isArray(response.notices) ? response.notices : [];
}

export async function fetchPropertyNotice(id: string): Promise<{ notice: NoticeSummary; deliveries: NoticeDelivery[] }> {
  return apiFetch(`/landlord/notices/${encodeURIComponent(id)}`) as Promise<{ notice: NoticeSummary; deliveries: NoticeDelivery[] }>;
}

export async function sendPropertyNotice(input: {
  propertyIds: string[];
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
