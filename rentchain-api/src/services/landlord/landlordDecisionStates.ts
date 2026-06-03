import { db } from "../../firebase";
import type {
  AgentDecisionState,
  LandlordAgentDecision,
  PersistedAgentDecisionState,
} from "../../lib/analytics/analyticsTypes";

export const LANDLORD_DECISION_STATES_COLLECTION = "landlordDecisionStates";

function asString(value: unknown, max = 240) {
  return String(value || "").trim().slice(0, max);
}

function stateRecordId(landlordId: string, decisionId: string) {
  return `${landlordId}__${decisionId}`.replace(/[\/\s]+/g, "_");
}

function validIsoTimestamp(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function effectiveState(record: PersistedAgentDecisionState | null, nowIso: string) {
  if (!record) return { state: "pending" as const, reviewedAt: null };
  if (record.state === "executed") {
    return { state: "executed" as const, reviewedAt: record.reviewedAt || null };
  }
  if (record.state === "dismissed") {
    return { state: "dismissed" as const, reviewedAt: record.reviewedAt || null };
  }
  if (record.state === "snoozed") {
    const snoozedUntil = validIsoTimestamp(record.snoozedUntil || null);
    if (snoozedUntil && new Date(snoozedUntil).getTime() > new Date(nowIso).getTime()) {
      return { state: "snoozed" as const, reviewedAt: record.reviewedAt || null };
    }
    return { state: "pending" as const, reviewedAt: record.reviewedAt || null };
  }
  if (record.state === "reviewed") {
    return { state: "reviewed" as const, reviewedAt: record.reviewedAt || null };
  }
  return { state: "pending" as const, reviewedAt: record.reviewedAt || null };
}

export async function loadLandlordDecisionStates(landlordId: string): Promise<PersistedAgentDecisionState[]> {
  const scopedLandlordId = asString(landlordId, 240);
  if (!scopedLandlordId) return [];
  const snap = await db.collection(LANDLORD_DECISION_STATES_COLLECTION).get().catch(() => ({ docs: [] } as any));
  return (snap.docs || [])
    .map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }) as PersistedAgentDecisionState)
    .filter((record: PersistedAgentDecisionState) => asString(record.landlordId, 240) === scopedLandlordId);
}

export function mergeLandlordDecisionStates(
  decisions: LandlordAgentDecision[],
  states: PersistedAgentDecisionState[],
  now = new Date().toISOString()
): LandlordAgentDecision[] {
  const stateByDecisionId = new Map(states.map((state) => [asString(state.decisionId, 240), state]));
  return decisions.flatMap((decision) => {
    const persisted = stateByDecisionId.get(asString(decision.id, 240)) || null;
    const next = effectiveState(persisted, now);
    if (next.state === "dismissed" || next.state === "snoozed") {
      return [];
    }
    if (!persisted) {
      return [{
        ...decision,
        state: decision.state || "pending",
        reviewedAt: decision.reviewedAt || null,
        executedAt: decision.executedAt || null,
        executionOutcomeStatus: decision.executionOutcomeStatus || "none",
        executionOutcomeAt: decision.executionOutcomeAt || null,
        executionOutcomeReason: decision.executionOutcomeReason || null,
      }];
    }

    return [{
      ...decision,
      state: next.state,
      reviewedAt: next.reviewedAt,
      executedAt: persisted.executedAt || null,
      executionOutcomeStatus: persisted.executionOutcomeStatus || "none",
      executionOutcomeAt: persisted.executionOutcomeAt || null,
      executionOutcomeReason: persisted.executionOutcomeReason || null,
    }];
  });
}

async function saveLandlordDecisionState(params: {
  landlordId: string;
  decisionId: string;
  state: AgentDecisionState;
  reviewedAt?: string | null;
  snoozedUntil?: string | null;
  snoozedAt?: string | null;
  dismissedAt?: string | null;
  executedAt?: string | null;
  executionOutcomeStatus?: "succeeded" | "failed" | null;
  executionOutcomeAt?: string | null;
  executionOutcomeReason?: string | null;
}): Promise<PersistedAgentDecisionState> {
  const landlordId = asString(params.landlordId, 240);
  const decisionId = asString(params.decisionId, 240);
  if (!landlordId || !decisionId) {
    throw new Error("landlord_decision_state_invalid");
  }

  const now = new Date().toISOString();
  const ref = db.collection(LANDLORD_DECISION_STATES_COLLECTION).doc(stateRecordId(landlordId, decisionId));
  const existingSnap = await ref.get().catch(() => null);
  const existing =
    existingSnap && typeof existingSnap.exists === "boolean" && existingSnap.exists
      ? ({ id: existingSnap.id, ...(existingSnap.data() || {}) } as PersistedAgentDecisionState)
      : null;

  const payload: PersistedAgentDecisionState = {
    id: existing?.id || ref.id,
    landlordId,
    decisionId,
    state: params.state,
    reviewedAt:
      params.reviewedAt !== undefined
        ? params.reviewedAt
        : existing?.reviewedAt ?? (params.state === "reviewed" ? now : null),
    snoozedUntil: params.snoozedUntil ?? null,
    snoozedAt: params.snoozedAt ?? null,
    dismissedAt: params.dismissedAt ?? null,
    executedAt: params.executedAt ?? existing?.executedAt ?? null,
    executionOutcomeStatus: params.executionOutcomeStatus ?? existing?.executionOutcomeStatus ?? null,
    executionOutcomeAt: params.executionOutcomeAt ?? existing?.executionOutcomeAt ?? null,
    executionOutcomeReason: params.executionOutcomeReason ?? existing?.executionOutcomeReason ?? null,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  await ref.set(payload, { merge: false });
  return payload;
}

export async function saveReviewedLandlordDecisionState(params: {
  landlordId: string;
  decisionId: string;
}): Promise<PersistedAgentDecisionState> {
  return await saveLandlordDecisionState({
    landlordId: params.landlordId,
    decisionId: params.decisionId,
    state: "reviewed",
  });
}

export async function saveSnoozedLandlordDecisionState(params: {
  landlordId: string;
  decisionId: string;
  snoozedUntil: string;
}): Promise<PersistedAgentDecisionState> {
  const snoozedUntil = validIsoTimestamp(params.snoozedUntil);
  if (!snoozedUntil) {
    throw new Error("landlord_decision_state_invalid_snoozed_until");
  }
  const now = new Date().toISOString();
  if (new Date(snoozedUntil).getTime() <= new Date(now).getTime()) {
    throw new Error("landlord_decision_state_snooze_must_be_future");
  }
  return await saveLandlordDecisionState({
    landlordId: params.landlordId,
    decisionId: params.decisionId,
    state: "snoozed",
    snoozedUntil,
    snoozedAt: now,
  });
}

export async function saveDismissedLandlordDecisionState(params: {
  landlordId: string;
  decisionId: string;
}): Promise<PersistedAgentDecisionState> {
  return await saveLandlordDecisionState({
    landlordId: params.landlordId,
    decisionId: params.decisionId,
    state: "dismissed",
    dismissedAt: new Date().toISOString(),
  });
}

export async function saveExecutedLandlordDecisionState(params: {
  landlordId: string;
  decisionId: string;
}): Promise<PersistedAgentDecisionState> {
  const executedAt = new Date().toISOString();
  return await saveLandlordDecisionState({
    landlordId: params.landlordId,
    decisionId: params.decisionId,
    state: "executed",
    executedAt,
    executionOutcomeStatus: "succeeded",
    executionOutcomeAt: executedAt,
    executionOutcomeReason: null,
  });
}

export async function saveFailedLandlordDecisionExecutionOutcome(params: {
  landlordId: string;
  decisionId: string;
  reason?: string | null;
}): Promise<PersistedAgentDecisionState> {
  const landlordId = asString(params.landlordId, 240);
  const decisionId = asString(params.decisionId, 240);
  if (!landlordId || !decisionId) {
    throw new Error("landlord_decision_state_invalid");
  }

  const ref = db.collection(LANDLORD_DECISION_STATES_COLLECTION).doc(stateRecordId(landlordId, decisionId));
  const existingSnap = await ref.get().catch(() => null);
  const existing =
    existingSnap && typeof existingSnap.exists === "boolean" && existingSnap.exists
      ? ({ id: existingSnap.id, ...(existingSnap.data() || {}) } as PersistedAgentDecisionState)
      : null;

  return await saveLandlordDecisionState({
    landlordId,
    decisionId,
    state: existing?.state === "executed" ? "executed" : existing?.state || "pending",
    reviewedAt: existing?.reviewedAt ?? null,
    snoozedUntil: existing?.snoozedUntil ?? null,
    snoozedAt: existing?.snoozedAt ?? null,
    dismissedAt: existing?.dismissedAt ?? null,
    executedAt: existing?.executedAt ?? null,
    executionOutcomeStatus: "failed",
    executionOutcomeAt: new Date().toISOString(),
    executionOutcomeReason: asString(params.reason, 240) || null,
  });
}
