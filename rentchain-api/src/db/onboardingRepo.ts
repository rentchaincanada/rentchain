import { db, FieldValue } from "../config/firebase";
import { OnboardingState } from "../models/Onboarding";

const STEP_KEYS: (keyof OnboardingState["steps"])[] = [
  "propertyAdded",
  "unitAdded",
  "tenantInvited",
  "applicationCreated",
  "exportPreviewed",
];

function normalizeSteps(steps?: OnboardingState["steps"]) {
  const base: OnboardingState["steps"] = {};
  STEP_KEYS.forEach((k) => {
    base[k] = Boolean(steps && (steps as any)[k]);
  });
  return base;
}

function defaultState(landlordId: string): OnboardingState {
  return {
    landlordId,
    dismissed: false,
    steps: normalizeSteps(),
    lastSeenAt: undefined,
  };
}

function docRef(landlordId: string) {
  return db
    .collection("landlords")
    .doc(landlordId)
    .collection("settings")
    .doc("onboarding");
}

export async function getOrCreateDefault(
  landlordId: string
): Promise<OnboardingState> {
  const ref = docRef(landlordId);
  const snap = await ref.get();
  if (!snap.exists) {
    const state = defaultState(landlordId);
    await ref.set(state, { merge: true });
    return state;
  }
  const data = snap.data() as OnboardingState;
  return {
    landlordId,
    dismissed: Boolean(data?.dismissed),
    steps: normalizeSteps(data?.steps),
    lastSeenAt: data?.lastSeenAt,
  };
}

export async function upsert(state: OnboardingState) {
  const ref = docRef(state.landlordId);
  await ref.set(state, { merge: true });
}

export async function markStep(
  landlordId: string,
  step: string,
  value: boolean
): Promise<OnboardingState> {
  const state = await getOrCreateDefault(landlordId);
  if (!STEP_KEYS.includes(step as keyof OnboardingState["steps"])) {
    return state;
  }
  const nextSteps = { ...state.steps, [step]: Boolean(value) };
  await upsert({ ...state, steps: nextSteps });
  return { ...state, steps: nextSteps };
}

export async function updateOnboarding(
  landlordId: string,
  patch: Partial<OnboardingState> & { touchLastSeen?: boolean }
): Promise<OnboardingState> {
  const ref = docRef(landlordId);
  const state = await getOrCreateDefault(landlordId);
  const next: OnboardingState = {
    landlordId,
    dismissed: patch.dismissed ?? state.dismissed ?? false,
    steps: normalizeSteps({ ...state.steps, ...(patch.steps || {}) }),
    lastSeenAt: state.lastSeenAt,
  };
  const payload: any = {
    dismissed: next.dismissed,
    steps: next.steps,
  };
  if (patch.touchLastSeen) {
    payload.lastSeenAt = FieldValue.serverTimestamp();
  }
  await ref.set(payload, { merge: true });
  const updated = await ref.get();
  const data = updated.data() as OnboardingState;
  return {
    landlordId,
    dismissed: Boolean(data?.dismissed),
    steps: normalizeSteps(data?.steps),
    lastSeenAt: data?.lastSeenAt,
  };
}
