import type { Request, Response, NextFunction } from "express";
import { requireAuth } from "./requireAuth";

export async function requireLandlordOrAdmin(req: Request, res: Response, next: NextFunction) {
  const validateRoleAndLandlord = () => {
    try {
      const user: any = (req as any).user;
      const role = user?.role;
      const landlordId = user?.landlordId || user?.id;

      if (!role) {
        return res.status(401).json({ ok: false, error: "Unauthorized" });
      }

      const isLandlord = role === "landlord";
      const isAdmin = role === "admin";

      if (!isLandlord && !isAdmin) {
        return res.status(403).json({ ok: false, error: "Forbidden" });
      }

      if (!landlordId || typeof landlordId !== "string" || !landlordId.trim()) {
        console.warn("[requireLandlordOrAdmin] missing landlordId user=", user);
        return res.status(401).json({ ok: false, error: "Missing landlord context" });
      }

      user.landlordId = landlordId;
      (req as any).user = user;

      return next();
    } catch {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }
  };

  if ((req as any).user) {
    return validateRoleAndLandlord();
  }

  return requireAuth(req, res, validateRoleAndLandlord);
}
