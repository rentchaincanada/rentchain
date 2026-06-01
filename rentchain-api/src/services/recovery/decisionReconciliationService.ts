import type {
  OperatorRecoveryLog,
  ReconciliationRequest,
  RecoveryAuthority,
} from "../../types/recovery";
import type { ReviewWorkflowType } from "../stateMachines/types";
import { asSafeText, isOperatorAuthority, stableRecoveryHash, toUtcIso } from "./recoveryShared";
import { buildDecisionReconciliation, inspectWorkflowState } from "./decisionStateInspector";
import {
  DECISION_CONTINUITY_SNAPSHOTS_COLLECTION,
  OPERATOR_RECOVERY_LOGS_COLLECTION,
  type RecoveryFirestoreLike,
  appendDocument,
  queryByWorkflow,
  recoveryDb,
} from "./recoveryStore";
import { appendRecoveryTimelineEntry, buildRecoveryTimelineEntry } from "./timelineRecoveryService";

export type ApplyReconciliationInput = {
  workflowType: ReviewWorkflowType;
  workflowId: string;
  request: ReconciliationRequest;
  authority: RecoveryAuthority;
  firestore?: RecoveryFirestoreLike;
};

function recoveryMetadata(input: { attemptCount: number; timestamp: string; decision: ReconciliationRequest["decisionType"]; timelineEntryId: string }) {
  return {
    recoveryAttemptCount: input.attemptCount,
    lastRecoveryTimestamp: input.timestamp,
    reconciliationDecision: input.decision,
    associatedTimelineEntryIds: [input.timelineEntryId],
    immutable: true as const,
  };
}

function recoveryLogId(input: {
  workflowType: ReviewWorkflowType;
  workflowInstanceKey: string;
  decision: string;
  reasonCode: string;
  timestamp: string;
}): string {
  return `operator_recovery:${stableRecoveryHash([
    input.workflowType,
    input.workflowInstanceKey,
    input.decision,
    input.reasonCode,
    input.timestamp,
  ])}`;
}

function validateRequest(request: ReconciliationRequest): ReconciliationRequest {
  const decision = request.decisionType;
  if (!["ACCEPT_CANONICAL", "ACCEPT_DERIVED", "EVIDENCE_REVIEW_REQUIRED"].includes(decision)) {
    throw new Error("recovery_decision_invalid");
  }
  const reasonCode = asSafeText(request.reasonCode, 120);
  const reason = asSafeText(request.reason, 800);
  if (!reasonCode || !reason) throw new Error("recovery_reason_required");
  return { decisionType: decision, reasonCode, reason };
}

export async function applyReconciliationDecision(input: ApplyReconciliationInput): Promise<{
  recoveryLog: OperatorRecoveryLog;
}> {
  if (!isOperatorAuthority(input.authority)) {
    throw new Error("recovery_reconciliation_forbidden");
  }
  const request = validateRequest(input.request);
  const inspection = await inspectWorkflowState(input);
  const reconciliation = buildDecisionReconciliation(inspection);
  if (!inspection.found) throw new Error("recovery_workflow_not_found");
  if (reconciliation.divergenceType === "NONE") throw new Error("recovery_not_required");

  const existingLogs = await queryByWorkflow(OPERATOR_RECOVERY_LOGS_COLLECTION, inspection.workflowInstanceKey, input.firestore);
  const duplicate = existingLogs.some(
    (record) =>
      record.divergenceType === reconciliation.divergenceType &&
      record.reconciliationDecision === request.decisionType &&
      record.reasonCode === request.reasonCode
  );
  if (duplicate) throw new Error("recovery_already_logged");

  const timestamp = toUtcIso();
  const preliminaryLogId = recoveryLogId({
    workflowType: input.workflowType,
    workflowInstanceKey: inspection.workflowInstanceKey,
    decision: request.decisionType,
    reasonCode: request.reasonCode,
    timestamp,
  });
  const timelineEntry = buildRecoveryTimelineEntry({
    workflowType: input.workflowType,
    workflowInstanceKey: inspection.workflowInstanceKey,
    logId: preliminaryLogId,
    divergenceType: reconciliation.divergenceType,
    decision: request.decisionType,
    reasonCode: request.reasonCode,
    authority: input.authority,
    occurredAt: timestamp,
  });
  const recoveryLog: OperatorRecoveryLog = {
    logId: preliminaryLogId,
    workflowType: input.workflowType,
    workflowInstanceKey: inspection.workflowInstanceKey,
    divergenceType: reconciliation.divergenceType,
    reconciliationDecision: request.decisionType,
    reasonCode: request.reasonCode,
    reasonSummary: request.reason,
    operator: {
      role: input.authority.role,
      operatorRef: input.authority.operatorRef,
      rawIdsIncluded: false,
    },
    evidence: inspection.evidence,
    recoveryMetadata: recoveryMetadata({
      attemptCount: existingLogs.length + 1,
      timestamp,
      decision: request.decisionType,
      timelineEntryId: timelineEntry.timelineEntryId,
    }),
    timelineEntryId: timelineEntry.timelineEntryId,
    createdAt: timestamp,
    metadataOnly: true,
    appendOnly: true,
    rawIdsIncluded: false,
    redactionSummary: "Raw workflow, actor, and data-store identifiers are replaced with deterministic safe references.",
  };
  await appendRecoveryTimelineEntry(timelineEntry, input.firestore);
  await appendDocument(OPERATOR_RECOVERY_LOGS_COLLECTION, recoveryLog.logId, recoveryLog, input.firestore);
  return { recoveryLog };
}

export async function getRecoveryHistory(input: {
  workflowType: ReviewWorkflowType;
  workflowId: string;
  authority: RecoveryAuthority;
  firestore?: RecoveryFirestoreLike;
}): Promise<OperatorRecoveryLog[]> {
  if (!isOperatorAuthority(input.authority)) throw new Error("recovery_history_forbidden");
  const inspection = await inspectWorkflowState(input);
  const records = await queryByWorkflow(OPERATOR_RECOVERY_LOGS_COLLECTION, inspection.workflowInstanceKey, input.firestore);
  return records
    .filter((record) => record.workflowType === input.workflowType)
    .map((record) => record as unknown as OperatorRecoveryLog)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listRecentRecoveryActions(input: {
  authority: RecoveryAuthority;
  limit?: number;
  firestore?: RecoveryFirestoreLike;
}): Promise<OperatorRecoveryLog[]> {
  if (!isOperatorAuthority(input.authority)) throw new Error("recovery_history_forbidden");
  const snap = await recoveryDb(input.firestore).collection(OPERATOR_RECOVERY_LOGS_COLLECTION).get();
  return snap.docs
    .map((doc) => doc.data() as unknown as OperatorRecoveryLog)
    .filter((record) => record?.metadataOnly === true && record.rawIdsIncluded === false)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, Math.min(Math.max(input.limit || 25, 1), 100));
}

export async function findWorkflowsNeedingRecovery(input: {
  authority: RecoveryAuthority;
  limit?: number;
  firestore?: RecoveryFirestoreLike;
}): Promise<Array<ReturnType<typeof buildDecisionReconciliation>>> {
  if (!isOperatorAuthority(input.authority)) throw new Error("recovery_inspection_forbidden");
  const snap = await recoveryDb(input.firestore).collection(DECISION_CONTINUITY_SNAPSHOTS_COLLECTION).get();
  const limit = Math.min(Math.max(input.limit || 25, 1), 100);
  const inspections = await Promise.all(
    snap.docs.slice(0, limit).map(async (doc) => {
      const data = doc.data();
      const workflowType = String(data?.workflowType || "decision") as ReviewWorkflowType;
      const workflowId = String(data?.workflowId || data?.id || doc.id);
      const inspection = await inspectWorkflowState({
        workflowType,
        workflowId,
        authority: input.authority,
        firestore: input.firestore,
      });
      return buildDecisionReconciliation(inspection);
    })
  );
  return inspections.filter((item) => item.divergenceType !== "NONE");
}
