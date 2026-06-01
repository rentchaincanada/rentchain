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
  | "redaction_note"
  | "recovery_action";

export type ReviewTimelineEntryStatus = "info" | "review_required" | "blocked" | "completed" | "redacted";

export type ReviewTimelineSource =
  | "canonical_events"
  | "decision_inbox"
  | "workflow_routing"
  | "operator_reviews"
  | "evidence_packs"
  | "institution_exports"
  | "audit_compliance"
  | "operator_recovery"
  | "unknown";

export type ReviewTimelineActor = {
  type: "system" | "landlord" | "admin" | "operator";
  id: string | null;
};

export type ReviewTimelineEntry = {
  timelineEntryId: string;
  entryType: ReviewTimelineEntryType;
  timestamp: string;
  label: string;
  description: string;
  status: ReviewTimelineEntryStatus;
  actor: ReviewTimelineActor;
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

export type DeriveCanonicalReviewTimelineInput = {
  scope: ReviewTimelineScope;
  scopeId: string;
  landlordId?: string | null;
  generatedAt?: string | Date | null;
  decisions?: Array<Record<string, any>> | null;
  operatorReviewSessions?: Array<Record<string, any>> | null;
  evidencePack?: Record<string, any> | null;
  institutionExportPackage?: Record<string, any> | null;
  auditComplianceReadiness?: Record<string, any> | null;
  canonicalEvents?: Array<Record<string, any>> | null;
  recoveryLogs?: Array<Record<string, unknown>> | null;
  filters?: {
    entryType?: unknown;
    status?: unknown;
    source?: unknown;
  } | null;
};
