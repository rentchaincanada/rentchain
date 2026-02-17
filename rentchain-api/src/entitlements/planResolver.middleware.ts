import type { Request, Response, NextFunction } from "express";
import { resolvePlan } from "./plans";

type AnyReq = Request & { user?: any };

export function attachPlan() {
  return (req: AnyReq, _res: Response, next: NextFunction) => {
    const headerPlan = req.headers["x-rentchain-plan"];
    const planStr =
      (req.user?.plan as string | undefined) ??
      (Array.isArray(headerPlan) ? headerPlan[0] : (headerPlan as string | undefined)) ??
      process.env.RENTCHAIN_DEFAULT_PLAN ??
      "free";

    const plan = resolvePlan(planStr);
    req.user = { ...(req.user || {}), plan };
    return next();
  };
}
