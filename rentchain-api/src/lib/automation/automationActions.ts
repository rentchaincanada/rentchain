import type {
  AutomationAction,
  AutomationActionContextMap,
} from "./automationTypes";

type AutomationActionOutcome<T = unknown> = {
  executed: boolean;
  skipped: boolean;
  reason?: string;
  data?: T;
};

async function runScreeningAction<T>(
  context: AutomationActionContextMap<T>["screening.auto_start_checkout"]
): Promise<AutomationActionOutcome<T>> {
  if (!context.quoteExists) {
    return { executed: false, skipped: true, reason: "SCREENING_QUOTE_REQUIRED" };
  }
  if (context.alreadyPaid) {
    return { executed: false, skipped: true, reason: "SCREENING_ALREADY_PAID" };
  }
  if (context.existingCheckout) {
    return { executed: false, skipped: true, reason: "SCREENING_CHECKOUT_ALREADY_EXISTS" };
  }
  const data = await context.execute();
  return { executed: true, skipped: false, data };
}

async function runMaintenanceAction<T>(
  context: AutomationActionContextMap<T>["maintenance.auto_approve_cost"]
): Promise<AutomationActionOutcome<T>> {
  if (context.alreadyApproved) {
    return { executed: false, skipped: true, reason: "MAINTENANCE_ALREADY_APPROVED" };
  }
  if (!context.hasSupportingEvidence) {
    return { executed: false, skipped: true, reason: "MAINTENANCE_EVIDENCE_REQUIRED" };
  }
  if (typeof context.actualCostCents !== "number" || context.actualCostCents <= 0) {
    return { executed: false, skipped: true, reason: "MAINTENANCE_COST_REQUIRED" };
  }
  if (context.actualCostCents > context.thresholdCents) {
    return { executed: false, skipped: true, reason: "MAINTENANCE_COST_REVIEW_REQUIRED" };
  }
  const data = await context.execute();
  return { executed: true, skipped: false, data };
}

async function runLeaseAction<T>(
  context: AutomationActionContextMap<T>["lease.auto_send_notice"]
): Promise<AutomationActionOutcome<T>> {
  if (!context.noticeReady) {
    return { executed: false, skipped: true, reason: "LEASE_NOTICE_NOT_READY" };
  }
  if (context.alreadySent) {
    return { executed: false, skipped: true, reason: "LEASE_NOTICE_ALREADY_SENT" };
  }
  if (!context.hasRequiredLegalInputs) {
    return { executed: false, skipped: true, reason: "LEASE_NOTICE_REQUIRED_INPUTS_MISSING" };
  }
  const data = await context.execute();
  return { executed: true, skipped: false, data };
}

export async function runAutomationAction<A extends AutomationAction, T = unknown>(
  action: A,
  context: AutomationActionContextMap<T>[A]
): Promise<AutomationActionOutcome<T>> {
  if (action === "screening.auto_start_checkout") {
    return runScreeningAction(context as AutomationActionContextMap<T>["screening.auto_start_checkout"]);
  }
  if (action === "maintenance.auto_approve_cost") {
    return runMaintenanceAction(context as AutomationActionContextMap<T>["maintenance.auto_approve_cost"]);
  }
  return runLeaseAction(context as AutomationActionContextMap<T>["lease.auto_send_notice"]);
}
