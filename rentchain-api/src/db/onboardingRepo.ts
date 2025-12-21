import { OnboardingState } from "../models/Onboarding";

const store: Map<string, OnboardingState> =
  (globalThis as any).__onboardingStore ||
  ((globalThis as any).__onboardingStore = new Map<string, OnboardingState>());

function defaultState(landlordId: string): OnboardingState {
  return {
    landlordId,
    completed: false,
    steps: {
      addProperty: { done: false },
      addUnits: { done: false },
      viewDashboard: { done: false },
    },
    updatedAt: new Date().toISOString(),
  };
}

export async function getOrCreateDefault(
  landlordId: string
): Promise<OnboardingState> {
  if (!store.has(landlordId)) {
    store.set(landlordId, defaultState(landlordId));
  }
  return store.get(landlordId)!;
}

export async function upsert(state: OnboardingState) {
  store.set(state.landlordId, state);
}

export async function markStep(
  landlordId: string,
  step: keyof OnboardingState["steps"],
  value: boolean
): Promise<OnboardingState> {
  const state = await getOrCreateDefault(landlordId);
  if (state.steps.hasOwnProperty(step)) {
    state.steps[step] = {
      done: value,
      doneAt: value ? new Date().toISOString() : undefined,
    };
    state.completed = Object.values(state.steps).every((s) => !!s.done);
    state.updatedAt = new Date().toISOString();
    await upsert(state);
  }
  return state;
}
