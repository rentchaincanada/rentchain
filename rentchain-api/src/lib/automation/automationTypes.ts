import type { PolicyEvaluationResult } from "../policy/policyTypes";

export type AutomationAction =
  | "screening.auto_start_checkout"
  | "maintenance.auto_approve_cost"
  | "lease.auto_send_notice";

export type AutomationExecutionResult = {
  action: AutomationAction;
  executed: boolean;
  skipped: boolean;
  reason?: string;
  timestamp: string;
};

export type ScreeningAutomationContext<T = unknown> = {
  quoteExists: boolean;
  existingCheckout: boolean;
  alreadyPaid: boolean;
  execute: () => Promise<T>;
};

export type MaintenanceAutomationContext<T = unknown> = {
  alreadyApproved: boolean;
  actualCostCents: number | null;
  thresholdCents: number;
  hasSupportingEvidence: boolean;
  execute: () => Promise<T>;
};

export type LeaseAutomationContext<T = unknown> = {
  noticeReady: boolean;
  alreadySent: boolean;
  hasRequiredLegalInputs: boolean;
  execute: () => Promise<T>;
};

export type AutomationActionContextMap<T = unknown> = {
  "screening.auto_start_checkout": ScreeningAutomationContext<T>;
  "maintenance.auto_approve_cost": MaintenanceAutomationContext<T>;
  "lease.auto_send_notice": LeaseAutomationContext<T>;
};

export type AutomationExecutorInput<A extends AutomationAction, T = unknown> = {
  action: A;
  policyResult: PolicyEvaluationResult;
  context: AutomationActionContextMap<T>[A];
  actor: {
    type?: "user" | "system" | "admin" | "tenant" | "landlord" | "contractor" | "service";
    id?: string | null;
    role?: string | null;
  };
  resource: {
    type: string;
    id: string;
    parentType?: string | null;
    parentId?: string | null;
  };
  visibility?: "internal" | "landlord" | "tenant" | "admin" | "system";
  metadata?: Record<string, unknown>;
};
