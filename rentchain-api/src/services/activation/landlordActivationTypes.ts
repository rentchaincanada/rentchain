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

export interface LandlordActivationStep {
  key: LandlordActivationStepKey;
  title: string;
  status: LandlordActivationStatus;
  description: string;
  actionLabel: string;
  actionPath: string;
}

export interface LandlordActivationSummary {
  steps: LandlordActivationStep[];
  completedCount: number;
  totalCount: number;
  nextStepKey: LandlordActivationStepKey | null;
}

export interface LandlordActivationSnapshot {
  propertyCount: number;
  unitCount: number;
  applicationCount: number;
  viewingCount: number;
  transunionStatus: string | null;
  hasScreening: boolean;
  hasDecisionReview: boolean;
  primaryApplicationId: string | null;
  reviewApplicationId: string | null;
}
