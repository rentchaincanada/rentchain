import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requirePermission } from "../middleware/requireAuthz";
import { loadTransUnionUsageReport } from "../services/screening/transUnionUsageReportService";

const router = Router();

router.get(
  "/screening/transunion-usage",
  requireAuth,
  requirePermission("system.admin"),
  async (req: any, res) => {
    try {
      const result = await loadTransUnionUsageReport({
        period: String(req.query?.period || "").trim() || null,
        startDate: String(req.query?.startDate || "").trim() || null,
        endDate: String(req.query?.endDate || "").trim() || null,
      });
      return res.json(result);
    } catch (err: any) {
      console.error("[adminScreeningUsageRoutes] transunion usage failed", err?.message || err);
      return res.status(500).json({ ok: false, error: "transunion_usage_report_failed" });
    }
  }
);

export default router;

