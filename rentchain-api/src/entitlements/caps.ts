import { PLANS, resolvePlan } from "./plans";

export function getLimits(planInput?: string | null) {
  const plan = resolvePlan(planInput);
  return { plan, limits: PLANS[plan].limits };
}
