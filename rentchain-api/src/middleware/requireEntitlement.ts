import { Response, NextFunction } from "express";
import { db } from "../config/firebase";
import { ENTITLEMENTS, PlanTier } from "../config/entitlements";
import { AuthenticatedRequest } from "./authMiddleware";

async function countResource(resource: string, landlordId: string): Promise<number> {
  switch (resource) {
    case "properties": {
      const snap = await db.collection("properties").where("landlordId", "==", landlordId).get();
      return snap.size;
    }
    case "units": {
      const snap = await db.collection("properties").where("landlordId", "==", landlordId).get();
      let unitsCount = 0;
      snap.docs.forEach((d) => {
        const p = d.data() as any;
        const u =
          typeof p.totalUnits === "number"
            ? p.totalUnits
            : typeof p.unitCount === "number"
            ? p.unitCount
            : Array.isArray(p.units)
            ? p.units.length
            : 0;
        unitsCount += Math.max(0, Number(u) || 0);
      });
      return unitsCount;
    }
    case "tenants": {
      const snap = await db
        .collection("tenants")
        .where("landlordId", "==", landlordId)
        .get()
        .catch(async () => {
          const fallback = await db.collection("tenants").get();
          return fallback;
        });
      return snap?.size ?? 0;
    }
    case "leases": {
      const snap = await db
        .collection("leases")
        .where("landlordId", "==", landlordId)
        .get()
        .catch(async () => {
          const fallback = await db.collection("leases").get();
          return fallback;
        });
      return snap?.size ?? 0;
    }
    default:
      return 0;
  }
}

export function requireEntitlement(resource: "properties" | "units" | "tenants" | "leases") {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const landlordId = req.user?.id;
      if (!landlordId) return res.status(401).json({ error: "Unauthorized" });

      const plan: PlanTier = (req.account?.plan as PlanTier) || "starter";
      const limits = ENTITLEMENTS[plan] || ENTITLEMENTS["starter"];

      const count = await countResource(resource, landlordId);

      const cap =
        resource === "properties"
          ? limits.maxProperties
          : resource === "units"
          ? limits.maxUnits
          : resource === "tenants"
          ? limits.maxTenants
          : limits.maxActiveLeases;

      if (typeof cap === "number" && count >= cap) {
        return res.status(402).json({
          code: "ENTITLEMENT_LIMIT_REACHED",
          resource,
          cap,
          plan,
          upgradeRequired: true,
        });
      }

      return next();
    } catch (err: any) {
      console.error("[requireEntitlement] error", err);
      return res.status(500).json({ error: "Failed to enforce entitlement" });
    }
  };
}
