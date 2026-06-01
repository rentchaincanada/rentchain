import type {
  RecoveryActionIntent,
  RecoveryActionType,
  RecoveryAuthority,
  RecoveryGateValidation,
  RecoveryIntentCaptureRequest,
} from "../../types/recovery";
import type { ReviewWorkflowType } from "../stateMachines/types";
import { asSafeText, isOperatorAuthority, stableRecoveryHash, toUtcIso } from "./recoveryShared";
import {
  DECISION_CONTINUITY_SNAPSHOTS_COLLECTION,
  OPERATOR_RECOVERY_INTENTS_COLLECTION,
  RECOVERY_TIMELINE_COLLECTION,
  type RecoveryFirestoreLike,
  appendDocument,
  loadSnapshot,
  queryByWorkflow,
  recoveryDb,
} from "./recoveryStore";

export const RECOVERY_INTENT_FRESHNESS_MS = 24 * 60 * 60 * 1000;

type RecoveryCandidateRecord = {
  workflowType: ReviewWorkflowType;
  workflowInstanceKey: string;
};

type CaptureIntentInput = {
  recoveryId: string;
  request: RecoveryIntentCaptureRequest;
  authority: RecoveryAuthority;
  firestore?: RecoveryFirestoreLike;
  now?: string;
};

type ValidateGateInput = {
  recoveryId: string;
  intentId: string;
  authority: RecoveryAuthority;
  firestore?: RecoveryFirestoreLike;
  now?: string;
};

const ACTION_TYPES: RecoveryActionType[] = ["ACCEPT_CANONICAL", "ACCEPT_DERIVED", "EVIDENCE_REVIEW_REQUIRED"];

function normalizeRecoveryId(value: unknown): string {
  const recoveryId = asSafeText(value, 300);
  if (!recoveryId) throw new Error("recovery_id_required");
  return recoveryId;
}

function normalizeActionType(value: unknown): RecoveryActionType {
  const actionType = String(value || "").trim() as RecoveryActionType;
  if (!ACTION_TYPES.includes(actionType)) throw new Error("recovery_intent_action_invalid");
  return actionType;
}

function normalizeIntentRequest(request: RecoveryIntentCaptureRequest): {
  actionType: RecoveryActionType;
  reasonSummary: string;
  authorizationConfirmed: true;
} {
  const actionType = normalizeActionType(request.actionType);
  const reasonSummary = asSafeText(request.reason, 800);
  if (!reasonSummary) throw new Error("recovery_intent_reason_required");
  if (request.authorizationConfirmed !== true) throw new Error("recovery_intent_authorization_required");
  return { actionType, reasonSummary, authorizationConfirmed: true };
}

async function loadRecoveryCandidate(
  recoveryId: string,
  firestore?: RecoveryFirestoreLike
): Promise<RecoveryCandidateRecord | null> {
  const snapshot = await loadSnapshot(DECISION_CONTINUITY_SNAPSHOTS_COLLECTION, recoveryId, firestore);
  if (snapshot) {
    return {
      workflowType: String(snapshot.workflowType || "decision") as ReviewWorkflowType,
      workflowInstanceKey: recoveryId,
    };
  }

  const timelineRecords = await queryByWorkflow(RECOVERY_TIMELINE_COLLECTION, recoveryId, firestore);
  const timeline = timelineRecords[0];
  if (timeline) {
    return {
      workflowType: String(timeline.workflowType || "decision") as ReviewWorkflowType,
      workflowInstanceKey: recoveryId,
    };
  }

  return null;
}

function intentId(input: {
  recoveryId: string;
  actionType: RecoveryActionType;
  operatorRef: string | null;
  capturedAt: string;
}): string {
  return `recovery_intent:${stableRecoveryHash([
    input.recoveryId,
    input.actionType,
    input.operatorRef,
    input.capturedAt,
  ])}`;
}

function expiresAt(capturedAt: string): string {
  return new Date(Date.parse(capturedAt) + RECOVERY_INTENT_FRESHNESS_MS).toISOString();
}

export async function captureRecoveryActionIntent(input: CaptureIntentInput): Promise<RecoveryActionIntent> {
  if (!isOperatorAuthority(input.authority)) throw new Error("recovery_intent_forbidden");
  const recoveryId = normalizeRecoveryId(input.recoveryId);
  const request = normalizeIntentRequest(input.request);
  const candidate = await loadRecoveryCandidate(recoveryId, input.firestore);
  if (!candidate) throw new Error("recovery_workflow_not_found");

  const existingIntents = await queryByWorkflow(OPERATOR_RECOVERY_INTENTS_COLLECTION, candidate.workflowInstanceKey, input.firestore);
  const duplicate = existingIntents.some(
    (intent) => intent.status === "captured" && intent.actionType === request.actionType
  );
  if (duplicate) throw new Error("recovery_intent_already_captured");

  const capturedAt = toUtcIso(input.now);
  const id = intentId({
    recoveryId,
    actionType: request.actionType,
    operatorRef: input.authority.operatorRef,
    capturedAt,
  });
  const intent: RecoveryActionIntent = {
    intentId: id,
    recoveryId,
    workflowType: candidate.workflowType,
    workflowInstanceKey: candidate.workflowInstanceKey,
    actionType: request.actionType,
    reasonSummary: request.reasonSummary,
    authorizationConfirmed: request.authorizationConfirmed,
    status: "captured",
    operator: {
      role: input.authority.role,
      operatorRef: input.authority.operatorRef,
      rawIdsIncluded: false,
    },
    capturedAt,
    expiresAt: expiresAt(capturedAt),
    metadataOnly: true,
    appendOnly: true,
    rawIdsIncluded: false,
    redactionSummary: "Raw workflow, actor, and data-store identifiers are replaced with deterministic safe references.",
  };

  await appendDocument(OPERATOR_RECOVERY_INTENTS_COLLECTION, intent.intentId, intent, input.firestore);
  return intent;
}

export async function validateRecoveryActionGate(input: ValidateGateInput): Promise<RecoveryGateValidation> {
  if (!isOperatorAuthority(input.authority)) throw new Error("recovery_gate_forbidden");
  const recoveryId = normalizeRecoveryId(input.recoveryId);
  const intentKey = asSafeText(input.intentId, 300);
  if (!intentKey) throw new Error("recovery_intent_required");

  const rawIntent = await loadSnapshot(OPERATOR_RECOVERY_INTENTS_COLLECTION, intentKey, input.firestore);
  if (!rawIntent || rawIntent.metadataOnly !== true || rawIntent.appendOnly !== true || rawIntent.rawIdsIncluded !== false) {
    return {
      gateStatus: "denied",
      reason: "intent_missing",
      intentStatus: "missing",
      authorizationValid: false,
      intentFresh: false,
    };
  }

  const intent = rawIntent as unknown as RecoveryActionIntent;
  const authorizationValid =
    intent.recoveryId === recoveryId &&
    (intent.operator.role === "admin" || intent.operator.role === "support") &&
    input.authority.role === intent.operator.role;
  const now = Date.parse(toUtcIso(input.now));
  const intentFresh = Number.isFinite(now) && Date.parse(intent.expiresAt) >= now;

  if (!authorizationValid) {
    return {
      gateStatus: "denied",
      reason: "authorization_invalid",
      intentStatus: intent.status,
      authorizationValid: false,
      intentFresh,
    };
  }

  if (!intentFresh) {
    return {
      gateStatus: "denied",
      reason: "intent_stale",
      intentStatus: intent.status,
      authorizationValid,
      intentFresh: false,
    };
  }

  return {
    gateStatus: "satisfied",
    intentStatus: intent.status,
    authorizationValid,
    intentFresh,
  };
}

export async function listRecentRecoveryIntents(input: {
  authority: RecoveryAuthority;
  limit?: number;
  firestore?: RecoveryFirestoreLike;
}): Promise<RecoveryActionIntent[]> {
  if (!isOperatorAuthority(input.authority)) throw new Error("recovery_intent_forbidden");
  const snap = await recoveryDb(input.firestore).collection(OPERATOR_RECOVERY_INTENTS_COLLECTION).get();
  return snap.docs
    .map((doc) => doc.data() as unknown as RecoveryActionIntent)
    .filter((record) => record?.metadataOnly === true && record.rawIdsIncluded === false && record.status === "captured")
    .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))
    .slice(0, Math.min(Math.max(input.limit || 25, 1), 100));
}
