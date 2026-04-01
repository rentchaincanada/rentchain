import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requirePermission } from "../middleware/requireAuthz";
import { listAdminLeases } from "../services/admin/adminLeaseView";
import { buildAdminLeasesCsv } from "../services/admin/adminCsvExport";

const router = Router();

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

      return res.json({ ok: true, ...result });
    } catch (err: any) {
      console.error("[adminLeasesRoutes] lease list failed", err?.message || err);
      return res.status(500).json({ ok: false, error: "admin_leases_list_failed" });
    }
  }
);

export default router;
