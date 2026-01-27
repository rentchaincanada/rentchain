import { Router } from "express";
import { getReportExport, getExportPdfBuffer, validateToken } from "../services/screening/reportExportService";

const router = Router();

router.get("/screening/report", async (req, res) => {
  try {
    const exportId = String(req.query?.exportId || "").trim();
    const token = String(req.query?.token || "").trim();
    if (!exportId || !token) {
      return res.status(400).json({ ok: false, error: "invalid_token" });
    }

    const exportDoc = await getReportExport(exportId);
    if (!exportDoc) {
      return res.status(404).json({ ok: false, error: "invalid_token" });
    }

    if (exportDoc.status === "revoked") {
      return res.status(403).json({ ok: false, error: "invalid_token" });
    }

    if (exportDoc.expiresAt && Date.now() > Number(exportDoc.expiresAt)) {
      return res.status(410).json({ ok: false, error: "expired" });
    }

    if (!validateToken(exportDoc, token)) {
      return res.status(403).json({ ok: false, error: "invalid_token" });
    }

    const pdfBuffer = await getExportPdfBuffer(exportDoc);
    if (!pdfBuffer) {
      return res.status(404).json({ ok: false, error: "not_ready" });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=\"screening_${exportId}.pdf\"`);
    return res.status(200).send(pdfBuffer);
  } catch (err: any) {
    console.error("[screening_report] read failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "SCREENING_REPORT_FAILED" });
  }
});

export default router;
