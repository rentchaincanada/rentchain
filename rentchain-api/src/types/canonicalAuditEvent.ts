import type { RecoveryActionType } from "./recovery";
import type { ReviewWorkflowType } from "../services/stateMachines/types";

export const CANONICAL_AUDIT_EVENT_TYPES = [
  "recovery_intent_captured",
  "recovery_gate_validated",
  "review_state_transitioned",
  "operator_review_opened",
  "operator_review_note_added",
  "operator_review_outcome_recorded",
  "operator_review_session_closed",
  "operator_review_manual_metadata_updated",
] as const;

export type CanonicalAuditEventType = (typeof CANONICAL_AUDIT_EVENT_TYPES)[number];

export type CanonicalAuditAuthorityRole = "admin" | "support" | "landlord" | "operator" | "system";

export type CanonicalAuditActor = {
  role: CanonicalAuditAuthorityRole;
  operatorRef: string | null;
  rawIdsIncluded: false;
};

export type CanonicalAuditAuthority = {
  role: CanonicalAuditAuthorityRole;
  landlordRef: string | null;
  supportAllowed: boolean;
  rawIdsIncluded: false;
};

export type RecoveryIntentCapturedAuditMetadata = {
  intentId: string;
  recoveryId: string;
  workflowType: ReviewWorkflowType;
  actionType: RecoveryActionType;
  reasonSummary: string;
  authorityRole: CanonicalAuditAuthorityRole;
  metadataOnly: true;
  rawIdsIncluded: false;
};

export type RecoveryGateValidatedAuditMetadata = {
  intentId: string;
  recoveryId: string;
  gateType: "recovery_action_intent";
  validationOutcome: "passed" | "failed";
  intentStatus: "captured" | "missing";
  authorizationValid: boolean;
  intentFresh: boolean;
  denialReason: string | null;
  metadataOnly: true;
  rawIdsIncluded: false;
};

export type ReviewStateTransitionedAuditMetadata = {
  workflowType: ReviewWorkflowType;
  workflowInstanceKey: string;
  fromState: string;
  toState: string;
  transitionEvent: string;
  transitionReason: string | null;
  validationOutcome: "valid" | "invalid";
  metadataOnly: true;
  rawIdsIncluded: false;
};

export type OperatorReviewAuditMetadata = {
  reviewSessionId: string;
  scope: string;
  scopeId: string;
  reviewStatus: string;
  assignmentTarget?: string;
  previousReviewStatus?: string | null;
  previousAssignmentTarget?: string | null;
  noteSummary?: string;
  outcome?: string | null;
  manualOnly: true;
  metadataOnly: true;
  rawIdsIncluded: false;
};

export type CanonicalAuditEventMetadata =
  | RecoveryIntentCapturedAuditMetadata
  | RecoveryGateValidatedAuditMetadata
  | ReviewStateTransitionedAuditMetadata
  | OperatorReviewAuditMetadata;

export type CanonicalAuditEvent = {
  eventId: string;
  eventType: CanonicalAuditEventType;
  timestamp: string;
  actor: CanonicalAuditActor;
  authority: CanonicalAuditAuthority;
  sourceReferenceId: string;
  metadata: CanonicalAuditEventMetadata;
  sourceCollection: "canonicalEvents";
  visibility: "admin_support_internal" | "landlord_operator_internal";
  metadataOnly: true;
  appendOnly: true;
  immutable: true;
  rawIdsIncluded: false;
  redactionSummary: string;
};
