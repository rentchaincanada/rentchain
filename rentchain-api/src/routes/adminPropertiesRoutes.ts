import { Router } from "express";
import { db, FieldValue } from "../config/firebase";
import { requireAuth } from "../middleware/requireAuth";
import { requirePermission } from "../middleware/requireAuthz";

const router = Router();

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
