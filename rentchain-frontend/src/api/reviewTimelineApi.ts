import { apiFetch } from "./apiFetch";

export type ReviewTimelineScope =
  | "decision"
  | "workflow"
  | "operator_review"
  | "evidence_pack"
  | "institution_export"
  | "audit_compliance"
  | "lease"
  | "property"
  | "delinquency"
  | "maintenance"
  | "admin_review";

export type ReviewTimelineEntryType =
  | "canonical_event"
  | "decision"
  | "workflow_transition"
  | "operator_review"
  | "evidence_reference"
  | "export_preview"
  | "readiness_check"
  | "delinquency_review"
  | "maintenance_review"
  | "redaction_note";

export type ReviewTimelineEntryStatus = "info" | "review_required" | "blocked" | "completed" | "redacted";

export type ReviewTimelineSource =
  | "canonical_events"
  | "decision_inbox"
  | "workflow_routing"
  | "operator_reviews"
  | "evidence_packs"
  | "institution_exports"
  | "audit_compliance"
  | "unknown";

export type ReviewTimelineEntry = {
  timelineEntryId: string;
  entryType: ReviewTimelineEntryType;
  timestamp: string;
  label: string;
  description: string;
  status: ReviewTimelineEntryStatus;
  actor: { type: "system" | "landlord" | "admin" | "operator"; id: string | null };
  source: ReviewTimelineSource;
  sourceId: string | null;
  destination: string | null;
  redacted: boolean;
  redactionReason: string | null;
  blockedReason: string | null;
  manualOnly: true;
};

export type CanonicalReviewTimeline = {
  timelineId: string;
  scope: ReviewTimelineScope;
  scopeId: string;
  generatedAt: string;
  manualReviewRequired: true;
  externalSharingEnabled: false;
  certificationIssued: false;
  entries: ReviewTimelineEntry[];
  filters: {
    entryType: ReviewTimelineEntryType[];
    status: ReviewTimelineEntryStatus[];
    source: ReviewTimelineSource[];
  };
  summary: {
    total: number;
    reviewRequired: number;
    blocked: number;
    completed: number;
    redacted: number;
  };
};

export type ReviewTimelineQuery = {
  scope: ReviewTimelineScope;
  scopeId: string;
  entryType?: ReviewTimelineEntryType | "all";
  status?: ReviewTimelineEntryStatus | "all";
  source?: ReviewTimelineSource | "all";
};

export function reviewTimelinePath(params: Pick<ReviewTimelineQuery, "scope" | "scopeId">) {
  const search = new URLSearchParams({ scope: params.scope, scopeId: params.scopeId });
  return `/review-timeline?${search.toString()}`;
}

export async function fetchReviewTimeline(params: ReviewTimelineQuery): Promise<CanonicalReviewTimeline> {
  const search = new URLSearchParams({ scope: params.scope, scopeId: params.scopeId });
  if (params.entryType && params.entryType !== "all") search.set("entryType", params.entryType);
  if (params.status && params.status !== "all") search.set("status", params.status);
  if (params.source && params.source !== "all") search.set("source", params.source);
  const response = await apiFetch<{ ok: true; timeline: CanonicalReviewTimeline }>(
    `/landlord/review-timeline?${search.toString()}`
  );
  return response.timeline;
}
