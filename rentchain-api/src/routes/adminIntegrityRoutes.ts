import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requirePermission } from "../middleware/requireAuthz";
import { loadAdminIntegrity } from "../services/admin/adminIntegrityView";
import { buildAdminIntegrityCsv } from "../services/admin/adminCsvExport";
import { recordAdminAuditEvent } from "../services/admin/adminAuditEvents";

const router = Router();

router.get(
  "/integrity/export.csv",
  requireAuth,
  requirePermission("system.admin"),
  async (req: any, res) => {
    try {
      const csv = await buildAdminIntegrityCsv();

      console.info("[admin.export]", {
        route: "/api/admin/integrity/export.csv",
        userId: String(req.user?.id || req.user?.sub || "").trim() || null,
        role: String(req.user?.role || "").toLowerCase(),
        adminAccessResolved: true,
        exportType: "integrity",
        format: "csv",
        filterSummary: {},
        rowCount: csv.rowCount,
        capped: csv.capped,
      });
      await recordAdminAuditEvent({
        userId: String(req.user?.id || req.user?.sub || "").trim(),
        category: "export",
        action: "export_integrity_csv",
        label: "Exported integrity CSV",
        pageKey: "integrity",
        route: "/api/admin/integrity/export.csv",
        relatedAdminPath: "/admin/integrity",
        exportType: "integrity",
        rowCount: csv.rowCount,
        capped: csv.capped,
      }).catch(() => undefined);

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${csv.filename}"`);
      return res.status(200).send(csv.content);
    } catch (err: any) {
      console.error("[adminIntegrityRoutes] integrity export failed", err?.message || err);
      return res.status(500).json({ ok: false, error: "admin_integrity_export_failed" });
    }
  }
);

router.get(
  "/integrity",
  requireAuth,
  requirePermission("system.admin"),
  async (req: any, res) => {
    try {
      const result = await loadAdminIntegrity();

      console.info("[admin.integrity]", {
        route: "/api/admin/integrity",
        userId: String(req.user?.id || req.user?.sub || "").trim() || null,
        role: String(req.user?.role || "").toLowerCase(),
        adminAccessResolved: true,
        totalIssues: result.totals.totalIssues,
        sectionKeys: result.sections.map((section) => section.key),
        sectionCounts: result.sections.map((section) => ({ key: section.key, count: section.count })),
      });
      await recordAdminAuditEvent({
        userId: String(req.user?.id || req.user?.sub || "").trim(),
        category: "integrity",
        action: "integrity_snapshot_viewed",
        label: `Viewed integrity snapshot with ${result.totals.totalIssues} issues`,
        pageKey: "integrity",
        route: "/api/admin/integrity",
        relatedAdminPath: "/admin/integrity",
        severity: result.totals.highSeverity > 0 ? "high" : result.totals.mediumSeverity > 0 ? "medium" : "low",
      }).catch(() => undefined);

      return res.json({ ok: true, ...result });
    } catch (err: any) {
      console.error("[adminIntegrityRoutes] integrity failed", err?.message || err);
      return res.status(500).json({ ok: false, error: "admin_integrity_failed" });
    }
  }
);

export default router;
