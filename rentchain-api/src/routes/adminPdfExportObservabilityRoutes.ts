import { Router } from "express";
import { db } from "../firebase";
import { requireAuth } from "../middleware/requireAuth";
import { requirePermission } from "../middleware/requireAuthz";
import { derivePdfExportDiagnostics } from "../lib/pdfExportObservability/derivePdfExportDiagnostics";
import type { PdfExportTelemetryRecord } from "../lib/pdfExportObservability/pdfExportObservabilityTypes";

const router = Router();

function normalizeRecord(doc: any): PdfExportTelemetryRecord | null {
  const data = doc?.data?.() || {};
  const eventName = String(data.eventName || "").trim();
  if (!eventName.startsWith("pdf_")) return null;
  return {
    id: String(doc.id || "").trim(),
    eventName: eventName as PdfExportTelemetryRecord["eventName"],
    createdAt: Number(data.createdAt || 0),
    userId: data.userId == null ? null : String(data.userId),
    landlordId: data.landlordId == null ? null : String(data.landlordId),
    role: data.role == null ? null : String(data.role),
    eventProps: data.eventProps && typeof data.eventProps === "object" ? data.eventProps : {},
  };
}

router.get("/pdf-export-observability", requireAuth, requirePermission("system.admin"), async (_req: any, res) => {
  try {
    const snap = await db.collection("telemetry_events").get();
    const records = (snap.docs || [])
      .map(normalizeRecord)
      .filter(Boolean) as PdfExportTelemetryRecord[];
    return res.json(derivePdfExportDiagnostics(records));
  } catch (err: any) {
    console.error("[adminPdfExportObservabilityRoutes] diagnostics failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "pdf_export_observability_failed" });
  }
});

export default router;
