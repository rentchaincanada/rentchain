import { Response, NextFunction } from "express";
import { db } from "../config/firebase";
import { setUsage } from "../services/accountService";
import type { LimitType } from "../utils/planLimits";
import { limitError, wouldExceed } from "../utils/planLimits";
import type { RequestHandler } from "express";
import type { Usage } from "../types/account";

type LimitConfig = {
  limitType: LimitType;
  /**
   * Returns the delta (how many new resources will be created).
   */
  delta: (req: any) => number | Promise<number>;
};

export function PlanLimits(configs: LimitConfig[]): RequestHandler {
  return async (req: any, res: Response, next: NextFunction) => {
    const account = req.account;
    if (!account) return res.status(500).json({ error: "Account not loaded" });

    const plan = account.plan || req.user?.plan || "screening";
    const ent = account.entitlements;
    const usage = account.usage;

    const getMax = (t: LimitType) => {
      switch (t) {
        case "properties":
          return ent.propertiesMax;
        case "units":
          return ent.unitsMax;
        default:
          return undefined as any;
      }
    };

    const getCurrent = (t: LimitType) => {
      switch (t) {
        case "properties":
          return usage.properties ?? 0;
        case "units":
          return usage.units ?? 0;
        default:
          return 0;
      }
    };

    try {
      for (const cfg of configs) {
        const max = getMax(cfg.limitType);
        if (typeof max !== "number") continue;

        const current = getCurrent(cfg.limitType);
        const rawDelta = await cfg.delta(req);
        const delta = Math.max(0, Number(rawDelta) || 0);

        if (delta === 0) continue;

        if (wouldExceed(current, delta, max)) {
          return res.status(402).json(
            limitError({
              plan,
              limitType: cfg.limitType,
              max,
              current,
              attempted: delta,
            })
          );
        }
      }

      return next();
    } catch (err) {
      console.error("[PlanLimits] error", err);
      return res.status(500).json({ error: "Failed to enforce plan limits" });
    }
  };
}

export async function computeUsageFromFirestore(req: any, res: Response, next: NextFunction) {
  try {
    const landlordId = req.user?.landlordId || req.user?.id;
    if (!landlordId) return res.status(401).json({ error: "Unauthorized" });
    if (!req.account) return res.status(500).json({ error: "Account not loaded" });

    const propsSnap = await db
      .collection("properties")
      .where("landlordId", "==", landlordId)
      .get();

    const propertiesCount = propsSnap.size;

    let unitsFromProperties = 0;
    for (const doc of propsSnap.docs) {
      const p = doc.data() as any;
      const u =
        typeof p.totalUnits === "number"
          ? p.totalUnits
          : typeof p.unitCount === "number"
          ? p.unitCount
          : Array.isArray(p.units)
          ? p.units.length
          : 0;
      unitsFromProperties += Math.max(0, Number(u) || 0);
    }

    let unitsFromUnitsCollection = 0;
    try {
      const countSnap = await db
        .collection("units")
        .where("landlordId", "==", landlordId)
        .count()
        .get();
      unitsFromUnitsCollection = (countSnap.data().count as number) || 0;
    } catch (err) {
      // Some environments may not support aggregation queries; fall back to a regular get().
      console.warn("[computeUsageFromFirestore] units count() unavailable; falling back", err);
      const unitsSnap = await db.collection("units").where("landlordId", "==", landlordId).get();
      unitsFromUnitsCollection = unitsSnap.size;
    }

    const unitsCount = Math.max(unitsFromUnitsCollection, unitsFromProperties);

    const screeningsThisMonth = await getScreeningsThisMonthCount({ landlordId });

    const before: Usage = normalizeUsage(req.account.usage);
    const after: Usage = {
      properties: propertiesCount,
      units: unitsCount,
      screeningsThisMonth,
    };

    const mismatch =
      before.properties !== after.properties ||
      before.units !== after.units ||
      before.screeningsThisMonth !== after.screeningsThisMonth;

    if (mismatch) {
      try {
        await setUsage(req.account.id, after);
      } catch (err) {
        console.error("[computeUsageFromFirestore] Failed to persist corrected usage", err);
      }
      req.integrity = { ok: false, before, after };
    } else {
      req.integrity = { ok: true };
    }

    req.account.usage = after;

    return next();
  } catch (err: any) {
    console.error("[computeUsageFromFirestore] error", err);
    return res.status(500).json({ error: "Failed to compute usage" });
  }
}

function normalizeUsage(input: any): Usage {
  return {
    properties: Math.max(0, Number(input?.properties) || 0),
    units: Math.max(0, Number(input?.units) || 0),
    screeningsThisMonth: Math.max(0, Number(input?.screeningsThisMonth) || 0),
  };
}

async function getScreeningsThisMonthCount(params: { landlordId: string }): Promise<number> {
  const { landlordId } = params;
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
  const startIso = start.toISOString();
  const endIso = end.toISOString();

  const inRange = (iso: any) => {
    if (typeof iso !== "string") return false;
    return iso >= startIso && iso < endIso;
  };

  // Preferred: narrow query (may require composite index in some Firestore setups).
  try {
    const snap = await db
      .collection("events")
      .where("landlordId", "==", landlordId)
      .where("type", "==", "screening_triggered")
      .where("occurredAt", ">=", startIso)
      .where("occurredAt", "<", endIso)
      .get();
    return snap.size;
  } catch (err) {
    // Fallbacks below: keep endpoints working even when indexes are missing.
    console.warn("[computeUsageFromFirestore] Screening count query fell back", err);
  }

  // Fallback: query by landlord only (and date range), then filter by type.
  try {
    const snap = await db
      .collection("events")
      .where("landlordId", "==", landlordId)
      .where("occurredAt", ">=", startIso)
      .where("occurredAt", "<", endIso)
      .get();

    let count = 0;
    for (const doc of snap.docs) {
      const data = doc.data() as any;
      if (data?.type !== "screening_triggered") continue;
      const occurredAt = data?.occurredAt ?? data?.createdAt;
      if (inRange(occurredAt)) count++;
    }
    return count;
  } catch (err) {
    console.warn("[computeUsageFromFirestore] Screening range query fell back", err);
  }

  // Final fallback: scan a bounded number of recent events for this landlord.
  try {
    const snap = await db
      .collection("events")
      .where("landlordId", "==", landlordId)
      .orderBy("occurredAt", "desc")
      .limit(500)
      .get();

    let count = 0;
    for (const doc of snap.docs) {
      const data = doc.data() as any;
      if (data?.type !== "screening_triggered") continue;
      const occurredAt = data?.occurredAt ?? data?.createdAt;
      if (inRange(occurredAt)) count++;
    }
    return count;
  } catch (err) {
    console.warn("[computeUsageFromFirestore] Screening scan query failed", err);
    return 0;
  }
}

export function enforcePropertyCreateCap(req: any, res: Response, next: NextFunction) {
  const ent = req.account?.entitlements;
  const usage = req.account?.usage;
  const plan = req.account?.plan || req.user?.plan || "screening";

  if (!ent || !usage) return res.status(500).json({ error: "Account not loaded" });

  const max = ent.propertiesMax;

  if (typeof max === "number" && wouldExceed(usage.properties, 1, max)) {
    return res.status(402).json(
      limitError({
        plan,
        limitType: "properties",
        max,
        current: usage.properties,
        attempted: 1,
      })
    );
  }

  return next();
}

export function enforceUnitsCreateCap(req: any, res: Response, next: NextFunction) {
  const account = req.account;
  if (!account) return res.status(500).json({ error: "Account not loaded" });

  const body = (req.body || {}) as any;

  const unitsToAdd =
    typeof body.totalUnits === "number" && body.totalUnits > 0
      ? body.totalUnits
      : Array.isArray(body.units)
      ? body.units.length
      : 0;

  const delta = Math.max(0, Number(unitsToAdd) || 0);
  const max = account.entitlements.unitsMax;
  const current = account.usage.units;
  const plan = account.plan || req.user?.plan || "screening";

  if (typeof max === "number" && wouldExceed(current, delta, max)) {
    return res.status(402).json(
      limitError({
        plan,
        limitType: "units",
        max,
        current,
        attempted: delta,
      })
    );
  }

  return next();
}
