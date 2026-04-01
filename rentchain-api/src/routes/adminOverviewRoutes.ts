import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requirePermission } from "../middleware/requireAuthz";
import { loadAdminOverview } from "../services/admin/adminOverviewView";
import { recordAdminAuditEvent } from "../services/admin/adminAuditEvents";

const router = Router();

router.get(
  "/overview",
  requireAuth,
  requirePermission("system.admin"),
  async (req: any, res) => {
    const startedAt = Date.now();
    try {
      const result = await loadAdminOverview();
      await recordAdminAuditEvent({
        userId: String(req.user?.id || req.user?.sub || "").trim(),
        category: "adminAction",
        action: "view_overview",
        label: "Viewed admin overview",
        pageKey: "overview" as any,
        route: "/api/admin/overview",
        relatedAdminPath: "/admin",
      }).catch(() => undefined);

      console.info("[admin.overview]", {
        route: "/api/admin/overview",
        userId: String(req.user?.id || req.user?.sub || "").trim() || null,
        role: String(req.user?.role || "").toLowerCase(),
        adminAccessResolved: true,
        summaryKeys: Object.keys(result.summary),
        integrityKeys: Object.keys(result.integrity),
        activityCount: result.activity.recentHighImpactEvents.length,
        durationMs: Date.now() - startedAt,
      });

      return res.json({ ok: true, ...result });
    } catch (err: any) {
      console.error("[adminOverviewRoutes] overview failed", err?.message || err);
      return res.status(500).json({ ok: false, error: "admin_overview_failed" });
    }
  }
);

export default router;
