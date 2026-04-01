import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requirePermission } from "../middleware/requireAuthz";
import { loadAdminIntegrity } from "../services/admin/adminIntegrityView";
import { buildAdminIntegrityCsv } from "../services/admin/adminCsvExport";

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

      return res.json({ ok: true, ...result });
    } catch (err: any) {
      console.error("[adminIntegrityRoutes] integrity failed", err?.message || err);
      return res.status(500).json({ ok: false, error: "admin_integrity_failed" });
    }
  }
);

export default router;
