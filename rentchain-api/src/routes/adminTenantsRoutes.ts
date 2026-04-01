import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requirePermission } from "../middleware/requireAuthz";
import { listAdminTenants } from "../services/admin/adminTenantView";
import { buildAdminTenantsCsv } from "../services/admin/adminCsvExport";
import { recordAdminAuditEvent } from "../services/admin/adminAuditEvents";

const router = Router();

router.get(
  "/tenants/export.csv",
  requireAuth,
  requirePermission("system.admin"),
  async (req: any, res) => {
    try {
      const csv = await buildAdminTenantsCsv({
        q: String(req.query?.q || "").trim() || null,
        landlordId: String(req.query?.landlordId || "").trim() || null,
        propertyId: String(req.query?.propertyId || "").trim() || null,
        leaseStatus: String(req.query?.leaseStatus || "").trim() || null,
        screeningStatus: String(req.query?.screeningStatus || "").trim() || null,
        moveInStatus: String(req.query?.moveInStatus || "").trim() || null,
        sortBy: (String(req.query?.sortBy || "").trim() as any) || null,
        sortDir: (String(req.query?.sortDir || "").trim() as any) || null,
      });

      console.info("[admin.export]", {
        route: "/api/admin/tenants/export.csv",
        userId: String(req.user?.id || req.user?.sub || "").trim() || null,
        role: String(req.user?.role || "").toLowerCase(),
        adminAccessResolved: true,
        exportType: "tenants",
        format: "csv",
        filterSummary: {
          q: String(req.query?.q || "").trim() || null,
          landlordId: String(req.query?.landlordId || "").trim() || null,
          propertyId: String(req.query?.propertyId || "").trim() || null,
          leaseStatus: String(req.query?.leaseStatus || "").trim() || null,
          screeningStatus: String(req.query?.screeningStatus || "").trim() || null,
          moveInStatus: String(req.query?.moveInStatus || "").trim() || null,
          sortBy: String(req.query?.sortBy || "").trim() || "updatedAt",
          sortDir: String(req.query?.sortDir || "").trim() || "desc",
        },
        rowCount: csv.rowCount,
        capped: csv.capped,
      });
      await recordAdminAuditEvent({
        userId: String(req.user?.id || req.user?.sub || "").trim(),
        category: "export",
        action: "export_tenants_csv",
        label: "Exported tenants CSV",
        pageKey: "tenants",
        route: "/api/admin/tenants/export.csv",
        relatedAdminPath: "/admin/tenants",
        exportType: "tenants",
        rowCount: csv.rowCount,
        capped: csv.capped,
      }).catch(() => undefined);

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${csv.filename}"`);
      return res.status(200).send(csv.content);
    } catch (err: any) {
      console.error("[adminTenantsRoutes] tenant export failed", err?.message || err);
      return res.status(500).json({ ok: false, error: "admin_tenants_export_failed" });
    }
  }
);

router.get(
  "/tenants",
  requireAuth,
  requirePermission("system.admin"),
  async (req: any, res) => {
    try {
      const result = await listAdminTenants({
        q: String(req.query?.q || "").trim() || null,
        landlordId: String(req.query?.landlordId || "").trim() || null,
        propertyId: String(req.query?.propertyId || "").trim() || null,
        leaseStatus: String(req.query?.leaseStatus || "").trim() || null,
        screeningStatus: String(req.query?.screeningStatus || "").trim() || null,
        moveInStatus: String(req.query?.moveInStatus || "").trim() || null,
        sortBy: (String(req.query?.sortBy || "").trim() as any) || null,
        sortDir: (String(req.query?.sortDir || "").trim() as any) || null,
        page: Number(req.query?.page ?? 1),
        pageSize: Number(req.query?.pageSize ?? 25),
      });

      console.info("[tenants.scope]", {
        route: "/api/admin/tenants",
        userId: String(req.user?.id || req.user?.sub || "").trim() || null,
        role: String(req.user?.role || "").toLowerCase(),
        adminAccessResolved: true,
        query: {
          q: String(req.query?.q || "").trim() || null,
          landlordId: String(req.query?.landlordId || "").trim() || null,
          propertyId: String(req.query?.propertyId || "").trim() || null,
          leaseStatus: String(req.query?.leaseStatus || "").trim() || null,
          screeningStatus: String(req.query?.screeningStatus || "").trim() || null,
          moveInStatus: String(req.query?.moveInStatus || "").trim() || null,
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
        action: "view_tenants",
        label: "Viewed tenants admin page",
        pageKey: "tenants",
        route: "/api/admin/tenants",
        relatedAdminPath: "/admin/tenants",
      }).catch(() => undefined);

      return res.json({ ok: true, ...result });
    } catch (err: any) {
      console.error("[adminTenantsRoutes] tenant list failed", err?.message || err);
      return res.status(500).json({ ok: false, error: "admin_tenants_list_failed" });
    }
  }
);

export default router;
