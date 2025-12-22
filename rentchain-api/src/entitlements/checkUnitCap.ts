import { PLANS } from "./plans";
import { getUsage } from "./usageDoc";

export async function assertCanAddUnits(req: any, landlordId: string, addCount: number) {
  const planKey = (req.plan?.key || req.plan || req.user?.plan || "starter") as keyof typeof PLANS;
  const limits = PLANS[planKey]?.limits || PLANS.starter.limits;
  const usage = await getUsage(landlordId);

  if (usage.units + addCount > limits.maxUnits) {
    return {
      ok: false as const,
      plan: planKey,
      current: usage.units,
      adding: addCount,
      limit: limits.maxUnits,
    };
  }

  return {
    ok: true as const,
    plan: planKey,
    current: usage.units,
    adding: addCount,
    limit: limits.maxUnits,
  };
}
