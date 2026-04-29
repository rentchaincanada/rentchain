import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requirePermission } from "../middleware/requireAuthz";
import { deriveSystemObservabilitySummary } from "../services/observability/deriveSystemObservabilitySummary";

const router = Router();

router.get(
  "/observability/summary",
  requireAuth,
  requirePermission("system.admin"),
  async (req: any, res: any) => {
    try {
      const period = String(req.query?.period || "").trim() === "30d" ? "30d" : "7d";
      const summary = await deriveSystemObservabilitySummary({ period });
      return res.json({ ok: true, summary });
    } catch (err: any) {
      console.error("[adminObservabilityRoutes] summary failed", err?.message || err);
      return res.status(500).json({ ok: false, error: "admin_observability_summary_failed" });
    }
  }
);

export default router;
