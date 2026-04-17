export const CANONICAL_PLAN_ORDER = ["free", "starter", "pro", "elite"] as const;

export type Plan = (typeof CANONICAL_PLAN_ORDER)[number];
export type PaidPlan = Exclude<Plan, "free">;

export function normalizePlan(input?: unknown, fallback: Plan = "free"): Plan {
  const value = String(input ?? "").trim().toLowerCase();
  if (!value) return fallback;
  if (value === "free" || value === "screening") return "free";
  if (value === "starter" || value === "core") return "starter";
  if (value === "pro" || value === "professional") return "pro";
  if (value === "elite" || value === "business" || value === "enterprise") return "elite";
  return fallback;
}

export function normalizePaidPlan(input?: unknown): PaidPlan | null {
  const plan = normalizePlan(input);
  if (plan === "starter" || plan === "pro" || plan === "elite") return plan;
  return null;
}

export function planLabel(plan: Plan): string {
  if (plan === "starter") return "Starter";
  if (plan === "pro") return "Pro";
  if (plan === "elite") return "Elite";
  return "Free";
}

export function isPlanAtLeast(current: Plan, required: Plan): boolean {
  return CANONICAL_PLAN_ORDER.indexOf(current) >= CANONICAL_PLAN_ORDER.indexOf(required);
}

export function resolvePlanFrom(args: { me?: any; limits?: any }, fallback: Plan = "free"): Plan {
  const fromLimits =
    args?.limits?.plan ??
    args?.limits?.tier ??
    args?.limits?.entitlements?.plan;
  if (fromLimits) return normalizePlan(fromLimits, fallback);

  const fromMe = args?.me?.plan ?? args?.me?.tier;
  if (fromMe) return normalizePlan(fromMe, fallback);

  return fallback;
}
