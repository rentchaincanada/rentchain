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
    ("screening" as Plan);
  return PLANS[plan] ? plan : "screening";
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
        "LIMIT_PROPERTIES",
        "plan_limit",
        { plan: planKey, current, limit, code: "LIMIT_PROPERTIES", error: "plan_limit", limitType: "properties" },
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
        "LIMIT_UNITS",
        "plan_limit",
        {
          plan: planKey,
          current,
          adding: batchCount,
          limit,
          code: "LIMIT_UNITS",
          error: "plan_limit",
          limitType: "units",
        },
        req.requestId
      );
    }
  } catch (err: any) {
    return jsonError(res, 500, "INTERNAL", "Failed to evaluate unit limits", err?.message, req.requestId);
  }

  return next();
}
