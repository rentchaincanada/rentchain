import { Router } from "express";
import { db, FieldValue } from "../config/firebase";
import { requireAuth } from "../middleware/requireAuth";
import { requirePermission } from "../middleware/requireAuthz";

const router = Router();

router.get(
  "/properties",
  requireAuth,
  requirePermission("system.admin"),
  async (req: any, res) => {
    try {
      const landlordFilter = String(req.query?.landlordId || "").trim() || null;
      const limitRaw = Number(req.query?.limit ?? 100);
      const limit =
        Number.isFinite(limitRaw) && limitRaw > 0
          ? Math.min(Math.max(limitRaw, 1), 500)
          : 100;

      let query: FirebaseFirestore.Query = db.collection("properties");
      if (landlordFilter) {
        query = query.where("landlordId", "==", landlordFilter);
      }
      const snap = await query.orderBy("createdAt", "desc").limit(limit).get();
      const items = (snap.docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }));

      console.info("[properties.scope]", {
        route: "/api/admin/properties",
        userId: String(req.user?.id || req.user?.sub || "").trim() || null,
        role: String(req.user?.role || "").toLowerCase(),
        returnedPropertyCount: items.length,
        adminOverridePathUsed: true,
      });

      return res.json({ ok: true, items, nextCursor: null });
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
