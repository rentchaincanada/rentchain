import type {
  DecisionReconciliation,
  DivergenceType,
  EvidenceSnapshot,
  RecoveryAuthority,
  RecoveryWorkflowState,
} from "../../types/recovery";
import type { ReviewWorkflowType, TransitionProvenanceEvent } from "../stateMachines/types";
import { queryProvenanceEvents } from "../stateMachines/provenanceStorage";
import { isOperatorAuthority, toUtcIso, workflowKey } from "./recoveryShared";
import {
  DECISION_CONTINUITY_SNAPSHOTS_COLLECTION,
  RECOVERY_TIMELINE_COLLECTION,
  type RecoveryFirestoreLike,
  loadSnapshot,
  queryByWorkflow,
} from "./recoveryStore";

export type WorkflowInspectionInput = {
  workflowType: ReviewWorkflowType;
  workflowId: string;
  authority: RecoveryAuthority;
  firestore?: RecoveryFirestoreLike;
};

export type WorkflowInspectionResult = {
  workflowType: ReviewWorkflowType;
  workflowInstanceKey: string;
  canonicalState: RecoveryWorkflowState;
  derivedState: RecoveryWorkflowState;
  evidence: EvidenceSnapshot;
  divergenceType: DivergenceType;
  found: boolean;
};

function stateFromRecord(
  record: Record<string, unknown> | null,
  fallbackSource: RecoveryWorkflowState["source"]
): RecoveryWorkflowState {
  if (!record) {
    return {
      state: "unknown",
      status: "missing",
      observedAt: null,
      source: "none",
    };
  }
  const state = String(record.state || record.status || record.toState || record.workflowState || "").trim();
  return {
    state: state || "unknown",
    status: state ? "known" : "unknown",
    observedAt: toUtcIso(record.updatedAt || record.createdAt || record.timestamp || record.occurredAt),
    source: fallbackSource,
  };
}

function latestRecord(records: Record<string, unknown>[]): Record<string, unknown> | null {
  if (records.length === 0) return null;
  return [...records].sort((a, b) => {
    const left = toUtcIso(a.updatedAt || a.createdAt || a.timestamp || a.occurredAt);
    const right = toUtcIso(b.updatedAt || b.createdAt || b.timestamp || b.occurredAt);
    return right.localeCompare(left);
  })[0];
}

function latestEvidence(events: TransitionProvenanceEvent[]): EvidenceSnapshot {
  const latest = [...events].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0] || null;
  return {
    evidenceRefCount: events.reduce((count, event) => count + event.evidenceRefs.length, 0),
    latestEvidenceAt: latest?.occurredAt || null,
    evidenceState: latest?.transition.to || null,
    metadataOnly: true,
  };
}

export function detectDivergence(input: {
  canonicalState: RecoveryWorkflowState;
  derivedState: RecoveryWorkflowState;
  evidence: EvidenceSnapshot;
}): DivergenceType {
  if (input.derivedState.status === "missing" && input.canonicalState.status === "missing") return "NONE";
  if (input.derivedState.status === "known" && input.canonicalState.status === "missing") return "ORPHANED_DECISION";
  if (input.derivedState.status === "missing" && input.canonicalState.status === "known") return "MISSING_TRANSITION";
  if (input.evidence.evidenceState && input.derivedState.status === "known" && input.evidence.evidenceState !== input.derivedState.state) {
    return "EVIDENCE_MISMATCH";
  }
  if (
    input.canonicalState.status === "known" &&
    input.derivedState.status === "known" &&
    input.canonicalState.state !== input.derivedState.state
  ) {
    return "METADATA_DIVERGENCE";
  }
  return "NONE";
}

export async function inspectWorkflowState(input: WorkflowInspectionInput): Promise<WorkflowInspectionResult> {
  if (!isOperatorAuthority(input.authority)) {
    throw new Error("recovery_inspection_forbidden");
  }
  const workflowInstanceKey = workflowKey(input.workflowType, input.workflowId);
  const [snapshot, timelineRecords, provenanceEvents] = await Promise.all([
    loadSnapshot(DECISION_CONTINUITY_SNAPSHOTS_COLLECTION, workflowInstanceKey, input.firestore),
    queryByWorkflow(RECOVERY_TIMELINE_COLLECTION, workflowInstanceKey, input.firestore),
    queryProvenanceEvents({
      workflowType: input.workflowType,
      workflowInstanceId: input.workflowId,
      authority: {
        actorRole: input.authority.role,
        actorRef: input.authority.operatorRef,
        landlordRef: input.authority.landlordRef,
        supportAllowed: input.authority.supportAllowed,
      },
      firestore: input.firestore,
    }),
  ]);
  const canonicalState = stateFromRecord(latestRecord(timelineRecords), "timeline");
  const derivedState = stateFromRecord(snapshot, "decision");
  const evidence = latestEvidence(provenanceEvents);
  const divergenceType = detectDivergence({ canonicalState, derivedState, evidence });
  return {
    workflowType: input.workflowType,
    workflowInstanceKey,
    canonicalState,
    derivedState,
    evidence,
    divergenceType,
    found: snapshot != null || timelineRecords.length > 0 || provenanceEvents.length > 0,
  };
}

export function buildDecisionReconciliation(inspection: WorkflowInspectionResult): DecisionReconciliation {
  let proposedDecision: DecisionReconciliation["proposedDecision"] = "NO_ACTION";
  if (inspection.divergenceType === "MISSING_TRANSITION" || inspection.divergenceType === "METADATA_DIVERGENCE") {
    proposedDecision = "ACCEPT_CANONICAL";
  } else if (inspection.divergenceType === "EVIDENCE_MISMATCH" || inspection.divergenceType === "ORPHANED_DECISION") {
    proposedDecision = "EVIDENCE_REVIEW_REQUIRED";
  }
  return {
    workflowType: inspection.workflowType,
    workflowInstanceKey: inspection.workflowInstanceKey,
    divergenceType: inspection.divergenceType,
    canonicalState: inspection.canonicalState,
    derivedState: inspection.derivedState,
    evidence: inspection.evidence,
    proposedDecision,
    reasonCode: inspection.divergenceType === "NONE" ? "NO_RECOVERY_REQUIRED" : `RECOVERY_${inspection.divergenceType}`,
    manualReviewRequired: inspection.divergenceType !== "NONE",
  };
}
