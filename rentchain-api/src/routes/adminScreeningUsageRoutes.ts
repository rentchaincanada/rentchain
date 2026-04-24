import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requirePermission } from "../middleware/requireAuthz";
import { loadTransUnionUsageReport } from "../services/screening/transUnionUsageReportService";
import { buildTransUnionUsagePdfBuffer } from "../services/screening/transUnionUsageReportPdf";

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

router.get(
  "/screening/transunion-usage/pdf",
  requireAuth,
  requirePermission("system.admin"),
  async (req: any, res) => {
    try {
      const report = await loadTransUnionUsageReport({
        period: String(req.query?.period || "").trim() || null,
        startDate: String(req.query?.startDate || "").trim() || null,
        endDate: String(req.query?.endDate || "").trim() || null,
      });
      const pdfBuffer = await buildTransUnionUsagePdfBuffer(report);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="rentchain-transunion-usage-summary-v1.pdf"'
      );
      return res.status(200).send(pdfBuffer);
    } catch (err: any) {
      console.error("[adminScreeningUsageRoutes] transunion usage pdf failed", err?.message || err);
      return res.status(500).json({ ok: false, error: "transunion_usage_pdf_failed" });
    }
  }
);

export default router;
