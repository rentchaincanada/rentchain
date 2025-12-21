export type SubscriptionPlan = "starter" | "core" | "pro" | "elite";

export const PLAN_ORDER: SubscriptionPlan[] = [
  "starter",
  "core",
  "pro",
  "elite",
];

export function planAtLeast(
  current: SubscriptionPlan,
  required: SubscriptionPlan
): boolean {
  const currentIndex = PLAN_ORDER.indexOf(current);
  const requiredIndex = PLAN_ORDER.indexOf(required);
  if (currentIndex === -1 || requiredIndex === -1) return false;
  return currentIndex >= requiredIndex;
}
