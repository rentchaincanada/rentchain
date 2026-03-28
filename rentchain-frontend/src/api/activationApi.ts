import { apiFetch } from "./apiFetch";

export type LandlordActivationStatus =
  | "not_started"
  | "in_progress"
  | "completed"
  | "blocked";

export type LandlordActivationStepKey =
  | "property"
  | "unit"
  | "applicant"
  | "viewing"
  | "transunion"
  | "screening"
  | "decision";

export type LandlordActivationStep = {
  key: LandlordActivationStepKey;
  title: string;
  status: LandlordActivationStatus;
  description: string;
  actionLabel: string;
  actionPath: string;
};

export type LandlordActivationSummary = {
  steps: LandlordActivationStep[];
  completedCount: number;
  totalCount: number;
  nextStepKey: LandlordActivationStepKey | null;
};

export async function getLandlordActivation(): Promise<LandlordActivationSummary> {
  return apiFetch<LandlordActivationSummary>("/landlord/activation");
}
