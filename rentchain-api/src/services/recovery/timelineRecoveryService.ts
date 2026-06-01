import type { OperatorRecoveryLog, RecoveryAuthority, RecoveryTimelineEntry } from "../../types/recovery";
import type { ReviewWorkflowType } from "../stateMachines/types";
import { asSafeText, stableRecoveryHash, toUtcIso } from "./recoveryShared";
import { appendDocument, RECOVERY_TIMELINE_COLLECTION, type RecoveryFirestoreLike } from "./recoveryStore";

export function buildRecoveryTimelineEntry(input: {
  workflowType: ReviewWorkflowType;
  workflowInstanceKey: string;
  logId: string;
  divergenceType: string;
  decision: string;
  reasonCode: string;
  authority: RecoveryAuthority & { role: "admin" | "support" };
  occurredAt?: string;
}): RecoveryTimelineEntry {
  const timestamp = toUtcIso(input.occurredAt);
  const timelineEntryId = `recovery_timeline:${stableRecoveryHash([
    input.workflowType,
    input.workflowInstanceKey,
    input.logId,
    timestamp,
  ])}`;
  return {
    timelineEntryId,
    workflowType: input.workflowType,
    workflowInstanceKey: input.workflowInstanceKey,
    entryType: "RECOVERY_ACTION",
    status: input.decision === "EVIDENCE_REVIEW_REQUIRED" ? "review_required" : "completed",
    label: "Recovery action recorded",
    description: asSafeText(`${input.reasonCode}: ${input.divergenceType}`, 500),
    source: "operator_recovery",
    sourceId: input.logId,
    timestamp,
    actorRole: input.authority.role,
    metadataOnly: true,
    appendOnly: true,
    rawIdsIncluded: false,
  };
}

export async function appendRecoveryTimelineEntry(
  entry: RecoveryTimelineEntry,
  firestore?: RecoveryFirestoreLike
): Promise<RecoveryTimelineEntry> {
  return appendDocument(RECOVERY_TIMELINE_COLLECTION, entry.timelineEntryId, entry, firestore);
}

export function timelineRecordFromLog(log: OperatorRecoveryLog): RecoveryTimelineEntry {
  return {
    timelineEntryId: log.timelineEntryId,
    workflowType: log.workflowType,
    workflowInstanceKey: log.workflowInstanceKey,
    entryType: "RECOVERY_ACTION",
    status: log.reconciliationDecision === "EVIDENCE_REVIEW_REQUIRED" ? "review_required" : "completed",
    label: "Recovery action recorded",
    description: `${log.reasonCode}: ${log.divergenceType}`,
    source: "operator_recovery",
    sourceId: log.logId,
    timestamp: log.createdAt,
    actorRole: log.operator.role,
    metadataOnly: true,
    appendOnly: true,
    rawIdsIncluded: false,
  };
}
