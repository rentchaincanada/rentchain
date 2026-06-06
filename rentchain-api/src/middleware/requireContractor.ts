import type { Request, Response, NextFunction } from "express";
import { requireAuth } from "./requireAuth";

function asString(value: unknown, max = 160): string {
  return String(value || "").trim().slice(0, max);
}

export async function requireContractor(req: Request, res: Response, next: NextFunction) {
  return requireAuth(req, res, () => {
    try {
      const user: any = (req as any).user;
      const role = asString(user?.actorRole || user?.role, 40).toLowerCase();
      const contractorId = asString(user?.contractorId || user?.id, 160);

      if (!role) {
        return res.status(401).json({ ok: false, error: "unauthorized" });
      }

      if (role !== "contractor" && role !== "admin") {
        return res.status(403).json({ ok: false, error: "forbidden" });
      }

      if (!contractorId) {
        return res.status(401).json({ ok: false, error: "missing_contractor_context" });
      }

      user.contractorId = contractorId;
      (req as any).user = user;
      return next();
    } catch {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }
  });
}
