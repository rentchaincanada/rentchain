import { apiFetch } from "./apiFetch";

export type LeaseLifecycleReviewSeverity = "info" | "warning" | "critical";

export type LeaseLifecycleReviewCategory =
  | "unknown_lifecycle"
  | "missing_dates"
  | "contradictory_status"
  | "expired_occupancy_conflict"
  | "renewal_ambiguity"
  | "termination_conflict"
  | "notice_conflict";

export type AdminLeaseLifecycleReviewItem = {
  id: string;
  leaseId: string;
  propertyId: string | null;
  unitId: string | null;
  landlordId: string | null;
  tenantId?: string | null;
  derivedLifecycleState: string;
  derivedLifecycleReasons: string[];
  severity: LeaseLifecycleReviewSeverity;
  category: LeaseLifecycleReviewCategory;
  title: string;
  description: string;
  recommendedAction: string;
  createdFrom: "lease_lifecycle_review_queue_v1";
  detectedAt: string;
};

export type AdminLeaseLifecycleReviewSummary = {
  total: number;
  critical: number;
  warning: number;
  info: number;
};

export type AdminLeaseLifecycleReviewResponse = {
  ok: true;
  items: AdminLeaseLifecycleReviewItem[];
  summary: AdminLeaseLifecycleReviewSummary;
};

export async function fetchAdminLeaseLifecycleReviewQueue(params?: {
  limit?: number | null;
}): Promise<AdminLeaseLifecycleReviewResponse> {
  const search = new URLSearchParams();
  if (typeof params?.limit === "number") search.set("limit", String(params.limit));
  const query = search.toString();
  return await apiFetch<AdminLeaseLifecycleReviewResponse>(
    `/admin/lease-lifecycle-review-queue${query ? `?${query}` : ""}`
  );
}
