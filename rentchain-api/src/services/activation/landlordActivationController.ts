import type { Request, Response } from "express";
import { getLandlordActivationSummary } from "./landlordActivationService";

export async function getLandlordActivation(req: Request, res: Response) {
  try {
    const user = (req as any).user || {};
    const role = String(user?.role || "").trim().toLowerCase();
    if (role !== "landlord" && role !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const landlordId = String(user?.landlordId || user?.id || "").trim();
    if (!landlordId) {
      return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    }

    const summary = await getLandlordActivationSummary(landlordId);
    return res.json(summary);
  } catch (err: any) {
    console.error("[landlord-activation] failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "LANDLORD_ACTIVATION_FAILED" });
  }
}
