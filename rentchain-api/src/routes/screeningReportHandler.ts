import { getReportExport, getExportPdfBuffer, validateToken } from "../services/screening/reportExportService";
import { requireCapability } from "../services/capabilityGuard";

export async function handleScreeningReport(req: any, res: any) {
  try {
    const exportId = String(req.query?.exportId || "").trim();
    const token = String(req.query?.token || "").trim();
    if (!exportId || !token) {
      return res.status(400).json({ ok: false, error: "invalid_token" });
    }

    const role = String(req.user?.role || "").toLowerCase();
    if (!role) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }

    if (role !== "admin") {
      const landlordId = req.user?.landlordId || req.user?.id;
      if (!landlordId) {
        return res.status(401).json({ ok: false, error: "unauthorized" });
      }
      const cap = await requireCapability(String(landlordId), "exports_basic");
      if (!cap.ok) {
        return res.status(402).json({
          ok: false,
          error: "upgrade_required",
          capability: "exports_basic",
          requiredPlan: "pro",
          plan: cap.plan,
          source: "screening_report_pdf",
        });
      }
    }

    const exportDoc = await getReportExport(exportId);
    if (!exportDoc) {
      return res.status(404).json({ ok: false, error: "invalid_token" });
    }

    if (exportDoc.status === "revoked") {
      return res.status(404).json({ ok: false, error: "invalid_token" });
    }

    if (exportDoc.expiresAt && Date.now() > Number(exportDoc.expiresAt)) {
      return res.status(410).json({ ok: false, error: "expired" });
    }

    if (!validateToken(exportDoc, token)) {
      return res.status(404).json({ ok: false, error: "invalid_token" });
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
}
