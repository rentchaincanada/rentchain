import { apiFetch } from "./apiFetch";

export type RecoveryWorkflowType = "screening" | "lease" | "maintenance" | "payment" | "decision";

export type RecoveryDecisionType =
  | "ACCEPT_CANONICAL"
  | "ACCEPT_DERIVED"
  | "EVIDENCE_REVIEW_REQUIRED"
  | "NO_ACTION";

export type RecoveryActionType = Exclude<RecoveryDecisionType, "NO_ACTION">;

export type RecoveryDivergenceType =
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

export type RecoveryEvidenceSnapshot = {
  evidenceRefCount: number;
  latestEvidenceAt: string | null;
  evidenceState: string | null;
  metadataOnly: true;
};

export type DecisionRecoveryInspection = {
  workflowType: RecoveryWorkflowType;
  workflowInstanceKey: string;
  divergenceType: RecoveryDivergenceType;
  canonicalState: RecoveryWorkflowState;
  derivedState: RecoveryWorkflowState;
  evidence: RecoveryEvidenceSnapshot;
  proposedDecision: RecoveryDecisionType;
  reasonCode: string;
  manualReviewRequired: boolean;
};

export type OperatorRecoveryLog = {
  logId: string;
  workflowType: RecoveryWorkflowType;
  workflowInstanceKey: string;
  divergenceType: RecoveryDivergenceType;
  reconciliationDecision: Exclude<RecoveryDecisionType, "NO_ACTION">;
  reasonCode: string;
  reasonSummary: string;
  operator: {
    role: "admin" | "support";
    operatorRef: string | null;
    rawIdsIncluded: false;
  };
  evidence: RecoveryEvidenceSnapshot;
  recoveryMetadata: {
    recoveryAttemptCount: number;
    lastRecoveryTimestamp: string;
    reconciliationDecision: RecoveryDecisionType;
    associatedTimelineEntryIds: string[];
    immutable: true;
  };
  timelineEntryId: string;
  createdAt: string;
  metadataOnly: true;
  appendOnly: true;
  rawIdsIncluded: false;
  redactionSummary: string;
};

export type RecoveryActionIntent = {
  intentId: string;
  recoveryId: string;
  workflowType: RecoveryWorkflowType;
  workflowInstanceKey: string;
  actionType: RecoveryActionType;
  reasonSummary: string;
  authorizationConfirmed: true;
  status: "captured";
  operator: {
    role: "admin" | "support";
    operatorRef: string | null;
    rawIdsIncluded: false;
  };
  capturedAt: string;
  expiresAt: string;
  metadataOnly: true;
  appendOnly: true;
  rawIdsIncluded: false;
  redactionSummary: string;
};

export type RecoveryGateValidation = {
  gateStatus: "satisfied" | "denied";
  reason?: string;
  intentStatus: RecoveryActionIntent["status"] | "missing";
  authorizationValid: boolean;
  intentFresh: boolean;
};

export type RecoveryLogsResponse = {
  ok: true;
  logs: OperatorRecoveryLog[];
  intents: RecoveryActionIntent[];
  candidates: DecisionRecoveryInspection[];
};

export type RecoveryInspectResponse = {
  ok: true;
  reconciliation: DecisionRecoveryInspection;
};

export async function inspectRecoveryWorkflow(input: {
  workflowType: RecoveryWorkflowType;
  workflowId: string;
}): Promise<RecoveryInspectResponse> {
  return apiFetch<RecoveryInspectResponse>("/admin/recovery/inspect", {
    method: "POST",
    body: {
      workflowType: input.workflowType,
      workflowId: input.workflowId,
    },
  });
}

export async function fetchRecoveryLogs(params?: {
  includeCandidates?: boolean;
  limit?: number;
}): Promise<RecoveryLogsResponse> {
  const query = new URLSearchParams();
  if (params?.includeCandidates) query.set("includeCandidates", "true");
  if (params?.limit) query.set("limit", String(params.limit));
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiFetch<RecoveryLogsResponse>(`/admin/recovery/logs${suffix}`);
}

export async function fetchRecoveryLog(logId: string): Promise<{
  ok: true;
  recoveryLog: OperatorRecoveryLog;
}> {
  return apiFetch<{ ok: true; recoveryLog: OperatorRecoveryLog }>(
    `/admin/recovery/logs/${encodeURIComponent(logId)}`
  );
}

export async function captureRecoveryIntent(input: {
  recoveryId: string;
  actionType: RecoveryActionType;
  reason: string;
  authorizationConfirmed: boolean;
}): Promise<{ ok: true; intent: RecoveryActionIntent }> {
  return apiFetch<{ ok: true; intent: RecoveryActionIntent }>(
    `/admin/recovery/${encodeURIComponent(input.recoveryId)}/intent`,
    {
      method: "POST",
      body: {
        actionType: input.actionType,
        reason: input.reason,
        authorizationConfirmed: input.authorizationConfirmed,
      },
    }
  );
}

export async function validateRecoveryGate(input: {
  recoveryId: string;
  intentId: string;
}): Promise<{ ok: true; gate: RecoveryGateValidation }> {
  return apiFetch<{ ok: true; gate: RecoveryGateValidation }>(
    `/admin/recovery/${encodeURIComponent(input.recoveryId)}/gate/validate`,
    {
      method: "POST",
      body: {
        intentId: input.intentId,
      },
    }
  );
}
