import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requirePermission } from "../middleware/requireAuthz";
import { loadTransUnionUsageReport } from "../services/screening/transUnionUsageReportService";
import { buildTransUnionUsagePdfBuffer } from "../services/screening/transUnionUsageReportPdf";
import { recordPdfExportTelemetry } from "../lib/pdfExportObservability/recordPdfExportTelemetry";
const router = Router();

function getReportQuery(req: any) {
  return {
    period: String(req.query?.period || "").trim() || null,
    startDate: String(req.query?.startDate || "").trim() || null,
    endDate: String(req.query?.endDate || "").trim() || null,
  };
}

router.get(
  "/screening/transunion-usage",
  requireAuth,
  requirePermission("system.admin"),
  async (req: any, res) => {
    try {
      const result = await loadTransUnionUsageReport(getReportQuery(req));
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
    const startedAt = Date.now();
    try {
      const report = await loadTransUnionUsageReport(getReportQuery(req));
      const pdfBuffer = await buildTransUnionUsagePdfBuffer(report);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="rentchain-transunion-usage-summary-v1.pdf"'
      );
      void recordPdfExportTelemetry({
        eventName: "pdf_export_completed",
        req,
        exportType: "transunion_usage",
        renderingPath: "backend_pdfkit",
        status: "completed",
        durationMs: Date.now() - startedAt,
        byteSize: pdfBuffer.byteLength,
      });
      return res.status(200).send(pdfBuffer);
    } catch (err: any) {
      void recordPdfExportTelemetry({
        eventName: "pdf_export_failed",
        req,
        exportType: "transunion_usage",
        renderingPath: "backend_pdfkit",
        status: "failed",
        durationMs: Date.now() - startedAt,
        errorCode: err?.message || "transunion_usage_pdf_failed",
      });
      console.error("[adminScreeningUsageRoutes] transunion usage pdf failed", err?.message || err);
      return res.status(500).json({ ok: false, error: "transunion_usage_pdf_failed" });
    }
  }
);

export default router;
