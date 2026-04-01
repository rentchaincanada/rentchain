import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requirePermission } from "../middleware/requireAuthz";
import { listAdminTenants } from "../services/admin/adminTenantView";

const router = Router();

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

      return res.json({ ok: true, ...result });
    } catch (err: any) {
      console.error("[adminTenantsRoutes] tenant list failed", err?.message || err);
      return res.status(500).json({ ok: false, error: "admin_tenants_list_failed" });
    }
  }
);

export default router;
