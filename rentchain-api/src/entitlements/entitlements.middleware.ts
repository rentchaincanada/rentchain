import type { Request, Response, NextFunction } from "express";
import { PLANS, resolvePlan, type Capability } from "./plans";

type AnyReq = Request & { user?: { plan?: string; [k: string]: any } };

export function requireCapability(cap: Capability) {
  return (req: AnyReq, res: Response, next: NextFunction) => {
    const planKey = resolvePlan(req.user?.plan);
    const spec = PLANS[planKey];
    if (spec.capabilities[cap]) return next();
    return res.status(403).json({
      error: "forbidden",
      message: `Plan '${planKey}' does not include capability '${cap}'.`,
      plan: planKey,
      required: cap,
    });
  };
}
