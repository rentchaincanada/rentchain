import { apiFetch } from "./apiFetch";

export type LeaseOverlapAuditGroup = {
  landlordId: string | null;
  propertyId: string | null;
  propertyName: string | null;
  unitId: string | null;
  unitNumber: string | null;
  unitLabel: string | null;
  overlapType: string;
  severity: string;
  confidence: string;
  leaseIds: string[];
  tenantIds: string[];
  leaseStatuses: string[];
  startDates: Array<string | null>;
  endDates: Array<string | null>;
  currentLeaseHints: string[];
  riskNotes: string[];
  sourceHints: string[];
  recommendedReviewAction: string;
  generatedAt: string;
  suggestedCanonicalLeaseId: string | null;
  suggestedLoserLeaseIds: string[];
  suggestionConfidence: "high" | "medium" | "low";
  suggestionReasons: string[];
};

export type LeaseOverlapAuditSummary = {
  generatedAt: string;
  overlapGroupCount: number;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
};

export type LeaseOverlapCleanupPreview = {
  dryRun: boolean;
  landlordId: string;
  propertyId: string;
  canonicalLeaseId: string;
  targetStatus: "superseded" | "inactive";
  group: LeaseOverlapAuditGroup | null;
  leaseChanges: Array<{
    leaseId: string;
    fromStatus: string | null;
    toStatus: string;
  }>;
  tenantChanges: Array<{
    tenantId: string;
    fromCurrentLeaseId: string | null;
    toCurrentLeaseId: string | null;
  }>;
};

export async function getAdminLeaseOverlapGroups(params?: {
  landlordId?: string;
  propertyId?: string;
}): Promise<{ groups: LeaseOverlapAuditGroup[]; summary: LeaseOverlapAuditSummary | null }> {
  const query = new URLSearchParams();
  if (params?.landlordId) query.set("landlordId", params.landlordId);
  if (params?.propertyId) query.set("propertyId", params.propertyId);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  const res = await apiFetch<{ ok: boolean; report: { groups: LeaseOverlapAuditGroup[]; summary?: LeaseOverlapAuditSummary | null } }>(
    `/admin/lease-overlaps${suffix}`
  );
  return { groups: res?.report?.groups || [], summary: res?.report?.summary || null };
}

export async function previewAdminLeaseOverlapCleanup(payload: {
  landlordId: string;
  propertyId: string;
  canonicalLeaseId: string;
  overlapLeaseIds: string[];
  targetStatus?: "superseded" | "inactive";
}) {
  return apiFetch<{ ok: boolean; preview: LeaseOverlapCleanupPreview }>("/admin/lease-overlaps/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function applyAdminLeaseOverlapCleanup(payload: {
  landlordId: string;
  propertyId: string;
  canonicalLeaseId: string;
  overlapLeaseIds: string[];
  targetStatus?: "superseded" | "inactive";
}) {
  return apiFetch<{ ok: boolean; result: LeaseOverlapCleanupPreview & { applied: boolean; resolutionLogId: string; actorUserId: string; appliedAt: string } }>(
    "/admin/lease-overlaps/apply",
    {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    }
  );
}
