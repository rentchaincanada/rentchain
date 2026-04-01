import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requirePermission } from "../middleware/requireAuthz";
import { loadAdminAudit } from "../services/admin/adminAuditView";

const router = Router();

router.get("/audit", requireAuth, requirePermission("system.admin"), async (req: any, res) => {
  try {
    const result = await loadAdminAudit();

    console.info("[admin.audit]", {
      route: "/api/admin/audit",
      userId: String(req.user?.id || req.user?.sub || "").trim() || null,
      role: String(req.user?.role || "").toLowerCase(),
      adminAccessResolved: true,
      summary: result.summary,
      sectionCounts: {
        adminActions: result.sections.adminActions.length,
        exports: result.sections.exports.length,
        integrityEvents: result.sections.integrityEvents.length,
        savedFilterActions: result.sections.savedFilterActions.length,
      },
    });

    return res.json({ ok: true, ...result });
  } catch (err: any) {
    console.error("[adminAuditRoutes] audit failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "admin_audit_failed" });
  }
});

export default router;
