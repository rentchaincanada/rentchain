import type { Request, Response, NextFunction } from "express";
import { requireAuth } from "./requireAuth";

export async function requireLandlord(req: Request, res: Response, next: NextFunction) {
  return requireAuth(req, res, () => {
    const user: any = (req as any).user;
    const role = user?.role;
    const landlordId = user?.landlordId || user?.id;

    if (role && role !== "landlord" && role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (!landlordId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    user.landlordId = landlordId;
    (req as any).user = user;

    return next();
  });
}
