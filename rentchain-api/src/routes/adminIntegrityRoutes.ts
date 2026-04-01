import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requirePermission } from "../middleware/requireAuthz";
import { loadAdminIntegrity } from "../services/admin/adminIntegrityView";

const router = Router();

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
