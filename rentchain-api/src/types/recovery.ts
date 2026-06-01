import type { ReviewWorkflowType } from "../services/stateMachines/types";

export type RecoveryAuthorityRole = "admin" | "support" | "landlord" | "tenant" | "system";

export type RecoveryAuthority = {
  role: RecoveryAuthorityRole;
  operatorRef: string | null;
  landlordRef: string | null;
  supportAllowed: boolean;
};

export type RecoveryDecisionType =
  | "ACCEPT_CANONICAL"
  | "ACCEPT_DERIVED"
  | "EVIDENCE_REVIEW_REQUIRED"
  | "NO_ACTION";

export type DivergenceType =
  | "NONE"
  | "MISSING_TRANSITION"
  | "ORPHANED_DECISION"
  | "EVIDENCE_MISMATCH"
  | "METADATA_DIVERGENCE";

export type RecoveryWorkflowState = {
  state: string;
  status: "known" | "missing" | "unknown";
  observedAt: string | null;
  source: "timeline" | "decision" | "provenance" | "none";
};

export type RecoveryMetadata = {
  recoveryAttemptCount: number;
  lastRecoveryTimestamp: string;
  reconciliationDecision: RecoveryDecisionType;
  associatedTimelineEntryIds: string[];
  immutable: true;
};

export type EvidenceSnapshot = {
  evidenceRefCount: number;
  latestEvidenceAt: string | null;
  evidenceState: string | null;
  metadataOnly: true;
};

export type DecisionReconciliation = {
  workflowType: ReviewWorkflowType;
  workflowInstanceKey: string;
  divergenceType: DivergenceType;
  canonicalState: RecoveryWorkflowState;
  derivedState: RecoveryWorkflowState;
  evidence: EvidenceSnapshot;
  proposedDecision: RecoveryDecisionType;
  reasonCode: string;
  manualReviewRequired: boolean;
};

export type ReconciliationRequest = {
  decisionType: Exclude<RecoveryDecisionType, "NO_ACTION">;
  reasonCode: string;
  reason: string;
};

export type OperatorRecoveryLog = {
  logId: string;
  workflowType: ReviewWorkflowType;
  workflowInstanceKey: string;
  divergenceType: DivergenceType;
  reconciliationDecision: Exclude<RecoveryDecisionType, "NO_ACTION">;
  reasonCode: string;
  reasonSummary: string;
  operator: {
    role: "admin" | "support";
    operatorRef: string | null;
    rawIdsIncluded: false;
  };
  evidence: EvidenceSnapshot;
  recoveryMetadata: RecoveryMetadata;
  timelineEntryId: string;
  createdAt: string;
  metadataOnly: true;
  appendOnly: true;
  rawIdsIncluded: false;
  redactionSummary: string;
};

export type RecoveryTimelineEntry = {
  timelineEntryId: string;
  workflowType: ReviewWorkflowType;
  workflowInstanceKey: string;
  entryType: "RECOVERY_ACTION";
  status: "completed" | "review_required";
  label: string;
  description: string;
  source: "operator_recovery";
  sourceId: string;
  timestamp: string;
  actorRole: "admin" | "support";
  metadataOnly: true;
  appendOnly: true;
  rawIdsIncluded: false;
};
