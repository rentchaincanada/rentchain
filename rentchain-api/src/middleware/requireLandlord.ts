import type { Request, Response, NextFunction } from "express";
import { requireAuth } from "./requireAuth";

export async function requireLandlord(req: Request, res: Response, next: NextFunction) {
  return requireAuth(req, res, () => {
    try {
      const user: any = (req as any).user;
      const role = user?.role;
      const landlordId = user?.landlordId || user?.id;

      if (!role) {
        return res.status(401).json({ ok: false, error: "Unauthorized" });
      }

      if (role !== "landlord" && role !== "admin") {
        return res.status(403).json({ ok: false, error: "Forbidden" });
      }

      if (!landlordId || typeof landlordId !== "string" || !landlordId.trim()) {
        console.warn("[requireLandlord] missing landlordId user=", user);
        return res.status(401).json({ ok: false, error: "Missing landlord context" });
      }

      user.landlordId = landlordId;
      (req as any).user = user;

      return next();
    } catch (e) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }
  });
}
