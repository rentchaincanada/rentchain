export interface OnboardingState {
  landlordId: string;
  completed: boolean;
  steps: {
    addProperty: { done: boolean; doneAt?: string };
    addUnits: { done: boolean; doneAt?: string };
    viewDashboard: { done: boolean; doneAt?: string };
  };
  updatedAt: string;
}
