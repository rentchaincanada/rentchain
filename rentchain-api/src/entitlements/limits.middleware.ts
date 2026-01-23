import type { Request, Response, NextFunction } from "express";
import { PLANS, Plan } from "./plans";
import { jsonError } from "../lib/httpResponse";
import { getUsage } from "./usageDoc";

function getLandlordId(req: Request): string | null {
  const u: any = (req as any).user;
  return (u?.landlordId || u?.id || null) as string | null;
}

function getPlanKey(req: Request): Plan {
  const anyReq: any = req as any;
  const plan =
    (anyReq.plan?.key as Plan | undefined) ||
    (anyReq.plan as Plan | undefined) ||
    (anyReq.user?.plan as Plan | undefined) ||
    ("starter" as Plan);
  return PLANS[plan] ? plan : "starter";
}

export async function enforcePropertyCap(req: Request, res: Response, next: NextFunction) {
  const landlordId = getLandlordId(req);
  if (!landlordId) {
    return jsonError(res, 401, "UNAUTHORIZED", "Unauthorized", undefined, req.requestId);
  }

  const planKey = getPlanKey(req);
  const limit = PLANS[planKey].limits.maxProperties;
  if (process.env.NODE_ENV !== "production") {
    console.log("[limits] property cap", { plan: planKey, limit });
  }
  if (!Number.isFinite(limit) || limit <= 0) {
    return next();
  }

  try {
    const usage = await getUsage(landlordId);
    const current = usage.properties;
    if (current >= limit) {
      return jsonError(
        res,
        409,
        "LIMIT_REACHED",
        "Plan limit reached: max properties",
        { plan: planKey, current, limit },
        req.requestId
      );
    }
  } catch (err: any) {
    return jsonError(res, 500, "INTERNAL", "Failed to evaluate property limits", err?.message, req.requestId);
  }

  return next();
}

export async function enforceUnitCap(req: Request, res: Response, next: NextFunction) {
  const landlordId = getLandlordId(req);
  if (!landlordId) {
    return jsonError(res, 401, "UNAUTHORIZED", "Unauthorized", undefined, req.requestId);
  }

  const planKey = getPlanKey(req);
  const limit = PLANS[planKey].limits.maxUnits;

  const body: any = req.body || {};
  const batchCount =
    Array.isArray(body.units) ? body.units.length :
    Array.isArray(body.items) ? body.items.length :
    1;

  try {
    const usage = await getUsage(landlordId);
    const current = usage.units;
    if (current + batchCount > limit) {
      return jsonError(
        res,
        409,
        "LIMIT_REACHED",
        "Plan limit reached: max units",
        { plan: planKey, current, adding: batchCount, limit },
        req.requestId
      );
    }
  } catch (err: any) {
    return jsonError(res, 500, "INTERNAL", "Failed to evaluate unit limits", err?.message, req.requestId);
  }

  return next();
}
