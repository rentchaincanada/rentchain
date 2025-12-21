import { Router, Request, Response } from "express";
import { authenticateJwt } from "../middleware/authMiddleware";
import { ensureActionRequestsForProperty } from "../services/actionRequestsEngine";

const router = Router();

router.post(
  "/recompute",
  authenticateJwt,
  async (req: Request, res: Response) => {
    const propertyId = String(req.query.propertyId ?? "").trim();
    if (!propertyId) {
      return res.status(400).json({ error: "propertyId is required" });
    }

    try {
      const result = await ensureActionRequestsForProperty({ propertyId });
      return res.json({ ok: true, result });
    } catch (err: any) {
      console.error("[action-requests] recompute failed", {
        propertyId,
        message: err?.message,
        code: err?.code,
        stack: err?.stack,
      });
      return res.status(500).json({
        error: "Failed to recompute action requests",
        details:
          process.env.NODE_ENV === "production"
            ? undefined
            : err?.message ?? String(err),
      });
    }
  }
);

export default router;
