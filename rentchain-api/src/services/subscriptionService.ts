import type { Request } from "express";
import {
  SubscriptionPlan,
  PLAN_ORDER,
  planAtLeast,
} from "../types/subscription";

export { SubscriptionPlan, PLAN_ORDER, planAtLeast };

export function resolvePlanFromRequest(req: Request): SubscriptionPlan {
  const header = (req.headers["x-demo-plan"] as string | undefined)?.toLowerCase();
  const envDefault =
    (process.env.DEFAULT_PLAN as SubscriptionPlan | undefined) || "screening";

  const candidate = (header || envDefault) as SubscriptionPlan;
  if (PLAN_ORDER.includes(candidate)) return candidate;
  return "screening";
}

/**
 * Express middleware factory: require at least a given plan.
 * Dev-only stub using header/env plan resolution.
 */
export function requirePlan(minPlan: SubscriptionPlan) {
  return (req: Request, res: any, next: any) => {
    const currentPlan = resolvePlanFromRequest(req);
    if (!planAtLeast(currentPlan, minPlan)) {
      return res.status(402).json({
        error: "upgrade_required",
        requiredPlan: minPlan,
        currentPlan,
      });
    }
    return next();
  };
}
