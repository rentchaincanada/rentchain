// Skeleton credit report billing helper (non-production).
import { recordUsageEvent } from "./subscriptionService";

const DEFAULT_CREDIT_PULL_COST = 19;

function getCreditPullCost(): number {
  const envValue = process.env.CREDIT_REPORT_COST;
  const parsed = envValue ? Number(envValue) : NaN;
  return Number.isFinite(parsed) ? parsed : DEFAULT_CREDIT_PULL_COST;
}

export async function billCreditReport(userId: string) {
  const cost = getCreditPullCost();

  await recordUsageEvent(userId, "CREDIT_PULL", cost);

  return {
    ok: true,
    reportId: "mock-report-id",
    cost,
    message: "Credit pull simulated. Billing event recorded.",
  };
}
