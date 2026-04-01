import { Router } from "express";
import { db, FieldValue } from "../config/firebase";
import { requireAuth } from "../middleware/requireAuth";
import { requirePermission } from "../middleware/requireAuthz";
import { listAdminProperties } from "../services/admin/adminPropertyView";

const router = Router();

router.get(
  "/properties",
  requireAuth,
  requirePermission("system.admin"),
  async (req: any, res) => {
    try {
      const result = await listAdminProperties({
        q: String(req.query?.q || "").trim() || null,
        province: String(req.query?.province || "").trim() || null,
        landlordId: String(req.query?.landlordId || "").trim() || null,
        ownerUserId: String(req.query?.ownerUserId || "").trim() || null,
        integrity: (String(req.query?.integrity || "").trim() as any) || null,
        sortBy: (String(req.query?.sortBy || "").trim() as any) || null,
        sortDir: (String(req.query?.sortDir || "").trim() as any) || null,
        page: Number(req.query?.page ?? 1),
        pageSize: Number(req.query?.pageSize ?? 25),
      });

      console.info("[properties.scope]", {
        route: "/api/admin/properties",
        userId: String(req.user?.id || req.user?.sub || "").trim() || null,
        role: String(req.user?.role || "").toLowerCase(),
        adminAccessResolved: true,
        query: {
          q: String(req.query?.q || "").trim() || null,
          province: String(req.query?.province || "").trim() || null,
          landlordId: String(req.query?.landlordId || "").trim() || null,
          ownerUserId: String(req.query?.ownerUserId || "").trim() || null,
          integrity: String(req.query?.integrity || "").trim() || "all",
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
      console.error("[adminPropertiesRoutes] property list failed", err?.message || err);
      return res.status(500).json({ ok: false, error: "admin_properties_list_failed" });
    }
  }
);

router.delete(
  "/properties/:propertyId",
  requireAuth,
  requirePermission("system.admin"),
  async (req: any, res) => {
    const propertyId = String(req.params?.propertyId || "").trim();
    if (!propertyId) return res.status(400).json({ ok: false, error: "Missing propertyId" });

    // delete units first
    let deletedUnits = 0;
    try {
      const unitsSnap = await db.collection("units").where("propertyId", "==", propertyId).get();
      if (!unitsSnap.empty) {
        const batch = db.batch();
        unitsSnap.docs.forEach((d) => {
          batch.delete(d.ref);
          deletedUnits += 1;
        });
        await batch.commit();
      }
    } catch (err: any) {
      console.error("[adminPropertiesRoutes] unit delete failed", err?.message || err);
    }

    await db
      .collection("properties")
      .doc(propertyId)
      .delete()
      .catch((err) => {
        console.error("[adminPropertiesRoutes] property delete failed", err?.message || err);
      });

    return res.json({ ok: true, propertyId, deletedUnits });
  }
);

export default router;
