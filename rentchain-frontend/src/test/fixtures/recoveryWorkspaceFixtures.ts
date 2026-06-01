import type {
  DecisionRecoveryInspection,
  OperatorRecoveryLog,
  RecoveryActionIntent,
  RecoveryLogsResponse,
} from "../../api/adminRecoveryApi";

export const recoveryInspectionFixture: DecisionRecoveryInspection = {
  workflowType: "decision",
  workflowInstanceKey: "decision:instance:safe-workflow-key",
  divergenceType: "METADATA_DIVERGENCE",
  canonicalState: {
    state: "Reviewed",
    status: "known",
    observedAt: "2026-06-01T12:00:00.000Z",
    source: "timeline",
  },
  derivedState: {
    state: "Appeared",
    status: "known",
    observedAt: "2026-06-01T11:45:00.000Z",
    source: "decision",
  },
  evidence: {
    evidenceRefCount: 3,
    latestEvidenceAt: "2026-06-01T11:59:00.000Z",
    evidenceState: "Reviewed",
    metadataOnly: true,
  },
  proposedDecision: "ACCEPT_CANONICAL",
  reasonCode: "RECOVERY_METADATA_DIVERGENCE",
  manualReviewRequired: true,
};

export const recoveryLogFixture: OperatorRecoveryLog = {
  logId: "operator_recovery:safe-log-key",
  workflowType: "decision",
  workflowInstanceKey: "decision:instance:safe-workflow-key",
  divergenceType: "METADATA_DIVERGENCE",
  reconciliationDecision: "ACCEPT_CANONICAL",
  reasonCode: "RECOVERY_METADATA_DIVERGENCE",
  reasonSummary: "Canonical timeline reviewed and accepted.",
  operator: {
    role: "admin",
    operatorRef: "operator:safe-operator-key",
    rawIdsIncluded: false,
  },
  evidence: {
    evidenceRefCount: 3,
    latestEvidenceAt: "2026-06-01T11:59:00.000Z",
    evidenceState: "Reviewed",
    metadataOnly: true,
  },
  recoveryMetadata: {
    recoveryAttemptCount: 1,
    lastRecoveryTimestamp: "2026-06-01T12:05:00.000Z",
    reconciliationDecision: "ACCEPT_CANONICAL",
    associatedTimelineEntryIds: ["recovery_timeline:safe-entry-key"],
    immutable: true,
  },
  timelineEntryId: "recovery_timeline:safe-entry-key",
  createdAt: "2026-06-01T12:05:00.000Z",
  metadataOnly: true,
  appendOnly: true,
  rawIdsIncluded: false,
  redactionSummary: "Raw workflow and actor identifiers are replaced with deterministic safe references.",
};

export const recoveryIntentFixture: RecoveryActionIntent = {
  intentId: "recovery_intent:safe-intent-key",
  recoveryId: "decision:instance:safe-workflow-key",
  workflowType: "decision",
  workflowInstanceKey: "decision:instance:safe-workflow-key",
  actionType: "ACCEPT_CANONICAL",
  reasonSummary: "Operator intends to accept canonical state after reviewing recovery evidence.",
  authorizationConfirmed: true,
  status: "captured",
  operator: {
    role: "admin",
    operatorRef: "operator:safe-operator-key",
    rawIdsIncluded: false,
  },
  capturedAt: "2026-06-01T12:10:00.000Z",
  expiresAt: "2026-06-02T12:10:00.000Z",
  metadataOnly: true,
  appendOnly: true,
  rawIdsIncluded: false,
  redactionSummary: "Raw workflow and actor identifiers are replaced with deterministic safe references.",
};

export function getRecoveryLogsFixtureResponse(): RecoveryLogsResponse {
  return {
    ok: true,
    logs: [recoveryLogFixture],
    intents: [recoveryIntentFixture],
    candidates: [recoveryInspectionFixture],
  };
}
