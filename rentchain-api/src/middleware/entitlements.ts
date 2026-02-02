import { Response, NextFunction } from "express";
import { Entitlements } from "../types/account";

export function requireFeature<K extends keyof Entitlements>(key: K) {
  return (req: any, res: Response, next: NextFunction) => {
    const ent = req.account?.entitlements;
    if (!ent) return res.status(500).json({ error: "Account not loaded" });

    const value = ent[key];

    if (typeof value === "boolean") {
      if (!value) {
        return res.status(402).json({
          ok: false,
          error: "upgrade_required",
          capability: key,
          upgradePath: "/pricing",
        });
      }
      return next();
    }

    if (key === "exports") {
      if (!value) {
        return res.status(402).json({
          ok: false,
          error: "upgrade_required",
          capability: key,
          upgradePath: "/pricing",
        });
      }
      return next();
    }

    return next();
  };
}

export function requireLimit(
  limitKey: "propertiesMax" | "unitsMax" | "usersMax",
  current: (req: any) => number
) {
  return (req: any, res: Response, next: NextFunction) => {
    const ent = req.account?.entitlements;
    if (!ent) return res.status(500).json({ error: "Account not loaded" });

    const max = ent[limitKey];
    const cur = current(req);

    if (typeof max === "number" && cur > max) {
      return res.status(403).json({
        error: "Plan limit exceeded",
        limit: { key: limitKey, max, current: cur },
        upgradePath: "/pricing",
      });
    }

    return next();
  };
}
