export const OPERATOR_REVIEW_SESSIONS_COLLECTION = "operatorReviewSessions";

export type OperatorReviewScope =
  | "decision"
  | "workflow"
  | "delinquency"
  | "institution_export"
  | "audit_compliance";

export type OperatorReviewStatus = "open" | "completed" | "escalated" | "abandoned";

export type OperatorReviewOutcomeResult =
  | "reviewed"
  | "needs_follow_up"
  | "escalated"
  | "blocked"
  | "unresolved";

export type OperatorReviewActorRole = "landlord" | "admin" | "operator";

export type OperatorReviewActor = {
  userId: string | null;
  role: OperatorReviewActorRole;
  email?: string | null;
};

export type OperatorReviewNote = {
  noteId: string;
  text: string;
  createdAt: string;
  actor: OperatorReviewActor;
};

export type OperatorReviewEvidenceReference = {
  evidenceId: string;
  label: string;
  kind: "decision" | "workflow" | "ledger" | "export_package" | "audit_readiness" | "unknown";
  destination?: string | null;
};

export type OperatorReviewOutcome = {
  result: OperatorReviewOutcomeResult;
  summary: string;
  recordedAt: string;
  recordedBy: OperatorReviewActor;
};

export type OperatorReviewSession = {
  reviewSessionId: string;
  landlordId: string;
  scope: OperatorReviewScope;
  scopeId: string;
  status: OperatorReviewStatus;
  openedAt: string;
  closedAt: string | null;
  openedBy: OperatorReviewActor;
  outcome: OperatorReviewOutcome | null;
  notes: OperatorReviewNote[];
  linkedEvidence: OperatorReviewEvidenceReference[];
  manualOnly: true;
  systemGenerated: false;
  updatedAt: string;
};

export type OperatorReviewOpenRequest = {
  scope: OperatorReviewScope;
  scopeId: string;
  linkedEvidence?: OperatorReviewEvidenceReference[];
  note?: string | null;
};

export type OperatorReviewNoteRequest = {
  note: string;
};

export type OperatorReviewCloseRequest = {
  result: OperatorReviewOutcomeResult;
  summary: string;
  status?: OperatorReviewStatus | null;
};

export type OperatorReviewEventType =
  | "operator_review_session_opened"
  | "operator_review_note_added"
  | "operator_review_outcome_recorded"
  | "operator_review_session_closed";
