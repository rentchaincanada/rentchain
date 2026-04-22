import { db } from "../../config/firebase";
import type {
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
  states: PersistedAgentDecisionState[]
): LandlordAgentDecision[] {
  const stateByDecisionId = new Map(states.map((state) => [asString(state.decisionId, 240), state]));
  return decisions.map((decision) => {
    const persisted = stateByDecisionId.get(asString(decision.id, 240)) || null;
    if (!persisted) {
      return {
        ...decision,
        state: decision.state || "pending",
        reviewedAt: decision.reviewedAt || null,
      };
    }

    return {
      ...decision,
      state: persisted.state || "pending",
      reviewedAt: persisted.reviewedAt || null,
    };
  });
}

export async function saveReviewedLandlordDecisionState(params: {
  landlordId: string;
  decisionId: string;
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
    state: "reviewed",
    reviewedAt: existing?.reviewedAt || now,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  await ref.set(payload, { merge: false });
  return payload;
}
