import { Router } from "express";
import { db } from "../config/firebase";
import { requireAuth } from "../middleware/requireAuth";
import { requirePermission } from "../middleware/requireAuthz";
import { listAdminLeases } from "../services/admin/adminLeaseView";
import { buildAdminLeasesCsv } from "../services/admin/adminCsvExport";
import { recordAdminAuditEvent } from "../services/admin/adminAuditEvents";
import { deriveLeaseLifecycleReviewQueue } from "../lib/leases/leaseLifecycleReviewQueue";

const router = Router();

function parseReviewQueueLimit(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 100;
  return Math.max(1, Math.min(250, Math.floor(parsed)));
}

async function loadCollection(name: string) {
  const snap = await db.collection(name).get();
  return (snap.docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }));
}

router.get(
  "/lease-lifecycle-review-queue",
  requireAuth,
  requirePermission("system.admin"),
  async (req: any, res) => {
    try {
      const limit = parseReviewQueueLimit(req.query?.limit);
      const [leases, units] = await Promise.all([loadCollection("leases"), loadCollection("units")]);
      const queue = deriveLeaseLifecycleReviewQueue({
        leases,
        units,
        today: req.query?.today || new Date(),
      });
      const items = queue.items.slice(0, limit);

      console.info("[leases.lifecycleReviewQueue]", {
        route: "/api/admin/lease-lifecycle-review-queue",
        userId: String(req.user?.id || req.user?.sub || "").trim() || null,
        role: String(req.user?.role || "").toLowerCase(),
        adminAccessResolved: true,
        resultCount: items.length,
        total: queue.summary.total,
      });

      return res.json({
        ok: true,
        items,
        summary: queue.summary,
      });
    } catch (err: any) {
      console.error("[adminLeasesRoutes] lifecycle review queue failed", err?.message || err);
      return res.status(500).json({ ok: false, error: "admin_lease_lifecycle_review_queue_failed" });
    }
  }
);

router.get(
  "/leases/export.csv",
  requireAuth,
  requirePermission("system.admin"),
  async (req: any, res) => {
    try {
      const csv = await buildAdminLeasesCsv({
        q: String(req.query?.q || "").trim() || null,
        landlordId: String(req.query?.landlordId || "").trim() || null,
        propertyId: String(req.query?.propertyId || "").trim() || null,
        status: String(req.query?.status || "").trim() || null,
        riskGrade: String(req.query?.riskGrade || "").trim() || null,
        integrity: (String(req.query?.integrity || "").trim() as any) || null,
        startAfter: String(req.query?.startAfter || "").trim() || null,
        startBefore: String(req.query?.startBefore || "").trim() || null,
        endAfter: String(req.query?.endAfter || "").trim() || null,
        endBefore: String(req.query?.endBefore || "").trim() || null,
        sortBy: (String(req.query?.sortBy || "").trim() as any) || null,
        sortDir: (String(req.query?.sortDir || "").trim() as any) || null,
      });

      console.info("[admin.export]", {
        route: "/api/admin/leases/export.csv",
        userId: String(req.user?.id || req.user?.sub || "").trim() || null,
        role: String(req.user?.role || "").toLowerCase(),
        adminAccessResolved: true,
        exportType: "leases",
        format: "csv",
        filterSummary: {
          q: String(req.query?.q || "").trim() || null,
          landlordId: String(req.query?.landlordId || "").trim() || null,
          propertyId: String(req.query?.propertyId || "").trim() || null,
          status: String(req.query?.status || "").trim() || null,
          riskGrade: String(req.query?.riskGrade || "").trim() || null,
          integrity: String(req.query?.integrity || "").trim() || "all",
          startAfter: String(req.query?.startAfter || "").trim() || null,
          startBefore: String(req.query?.startBefore || "").trim() || null,
          endAfter: String(req.query?.endAfter || "").trim() || null,
          endBefore: String(req.query?.endBefore || "").trim() || null,
          sortBy: String(req.query?.sortBy || "").trim() || "updatedAt",
          sortDir: String(req.query?.sortDir || "").trim() || "desc",
        },
        rowCount: csv.rowCount,
        capped: csv.capped,
      });
      await recordAdminAuditEvent({
        userId: String(req.user?.id || req.user?.sub || "").trim(),
        category: "export",
        action: "export_leases_csv",
        label: "Exported leases CSV",
        pageKey: "leases",
        route: "/api/admin/leases/export.csv",
        relatedAdminPath: "/admin/leases",
        exportType: "leases",
        rowCount: csv.rowCount,
        capped: csv.capped,
      }).catch(() => undefined);

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${csv.filename}"`);
      return res.status(200).send(csv.content);
    } catch (err: any) {
      console.error("[adminLeasesRoutes] lease export failed", err?.message || err);
      return res.status(500).json({ ok: false, error: "admin_leases_export_failed" });
    }
  }
);

router.get(
  "/leases",
  requireAuth,
  requirePermission("system.admin"),
  async (req: any, res) => {
    try {
      const result = await listAdminLeases({
        q: String(req.query?.q || "").trim() || null,
        landlordId: String(req.query?.landlordId || "").trim() || null,
        propertyId: String(req.query?.propertyId || "").trim() || null,
        status: String(req.query?.status || "").trim() || null,
        riskGrade: String(req.query?.riskGrade || "").trim() || null,
        integrity: (String(req.query?.integrity || "").trim() as any) || null,
        startAfter: String(req.query?.startAfter || "").trim() || null,
        startBefore: String(req.query?.startBefore || "").trim() || null,
        endAfter: String(req.query?.endAfter || "").trim() || null,
        endBefore: String(req.query?.endBefore || "").trim() || null,
        sortBy: (String(req.query?.sortBy || "").trim() as any) || null,
        sortDir: (String(req.query?.sortDir || "").trim() as any) || null,
        page: Number(req.query?.page ?? 1),
        pageSize: Number(req.query?.pageSize ?? 25),
      });

      console.info("[leases.scope]", {
        route: "/api/admin/leases",
        userId: String(req.user?.id || req.user?.sub || "").trim() || null,
        role: String(req.user?.role || "").toLowerCase(),
        adminAccessResolved: true,
        query: {
          q: String(req.query?.q || "").trim() || null,
          landlordId: String(req.query?.landlordId || "").trim() || null,
          propertyId: String(req.query?.propertyId || "").trim() || null,
          status: String(req.query?.status || "").trim() || null,
          riskGrade: String(req.query?.riskGrade || "").trim() || null,
          integrity: String(req.query?.integrity || "").trim() || "all",
          startAfter: String(req.query?.startAfter || "").trim() || null,
          startBefore: String(req.query?.startBefore || "").trim() || null,
          endAfter: String(req.query?.endAfter || "").trim() || null,
          endBefore: String(req.query?.endBefore || "").trim() || null,
          sortBy: String(req.query?.sortBy || "").trim() || "updatedAt",
          sortDir: String(req.query?.sortDir || "").trim() || "desc",
        },
        page: result.page,
        pageSize: result.pageSize,
        resultCount: result.items.length,
        total: result.total,
        adminOverridePathUsed: true,
      });
      await recordAdminAuditEvent({
        userId: String(req.user?.id || req.user?.sub || "").trim(),
        category: "adminAction",
        action: "view_leases",
        label: "Viewed leases admin page",
        pageKey: "leases",
        route: "/api/admin/leases",
        relatedAdminPath: "/admin/leases",
      }).catch(() => undefined);

      return res.json({ ok: true, ...result });
    } catch (err: any) {
      console.error("[adminLeasesRoutes] lease list failed", err?.message || err);
      return res.status(500).json({ ok: false, error: "admin_leases_list_failed" });
    }
  }
);

export default router;
