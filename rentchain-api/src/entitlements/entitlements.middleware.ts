import type { Request, Response, NextFunction } from "express";
import { PLANS, resolvePlan, type Capability } from "./plans";

type AnyReq = Request & { user?: { plan?: string; [k: string]: any } };

export function requireCapability(cap: Capability) {
  return (req: AnyReq, res: Response, next: NextFunction) => {
    const role = String(req.user?.role || "").toLowerCase();
    if (role === "admin") return next();

    const userCapabilities = Array.isArray(req.user?.capabilities)
      ? req.user!.capabilities.map((value: any) => String(value))
      : [];
    if (userCapabilities.includes(cap)) return next();

    const planKey = resolvePlan(req.user?.plan);
    const spec = PLANS[planKey];
    if (spec.capabilities[cap]) return next();
    return res.status(403).json({
      ok: false,
      error: "upgrade_required",
      code: "upgrade_required",
      message: `Plan '${planKey}' does not include capability '${cap}'.`,
      plan: planKey,
      requiredCapability: cap,
      capability: cap,
      upgradePath: "/pricing",
    });
  };
}
