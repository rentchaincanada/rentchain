// rentchain-api/src/routes/propertiesRoutes.ts
import { Router } from "express";
import { requireCapability } from "../entitlements/entitlements.middleware";
import { enforcePropertyCap, enforceUnitCap } from "../entitlements/limits.middleware";
import { db } from "../config/firebase";

const router = Router();

/**
 * GET /api/properties
 * Returns properties for the authenticated landlord.
 */
router.get("/", async (req: any, res) => {
  const landlordId = req.user?.landlordId || req.user?.id;
  if (!landlordId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  res.setHeader("x-route-source", "propertiesRoutes");
  console.log("[GET /api/properties] user=", req.user);
  console.log("[GET /api/properties] landlordId=", landlordId);

  try {
    const limitRaw = Number(req.query?.limit ?? 50);
    const limit =
      Number.isFinite(limitRaw) && limitRaw > 0
        ? Math.min(Math.max(limitRaw, 1), 200)
        : 50;

    const snap = await db
      .collection("properties")
      .where("landlordId", "==", landlordId)
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();

    const mineItems = snap.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as any),
    })) as any[];

    return res.json({ items: mineItems, nextCursor: null });
  } catch (err: any) {
    console.error("[GET /api/properties] query failed", err);
    return res.status(500).json({
      error: "db_failed",
      message: err?.message || "Failed to load properties",
    });
  }
});

/**
 * POST /api/properties
 * Creates a new property for the authenticated landlord.
 * Enforces plan property cap via enforcePropertyCap.
 */
router.post(
  "/",
  requireCapability("properties.create"),
  enforcePropertyCap,
  async (req: any, res) => {
    const landlordId = req.user?.landlordId || req.user?.id;
    if (!landlordId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const plan = req.user?.plan || "starter";
    if (process.env.NODE_ENV !== "production") {
      console.log("[POST /api/properties] landlordId=", landlordId);
      console.log("[POST /api/properties] plan=", plan);
    }

    const { address, nickname, unitCount, totalUnits, units } = req.body ?? {};
    const createdAt = new Date().toISOString();

    const resolvedUnitCount =
      typeof unitCount === "number"
        ? unitCount
        : typeof totalUnits === "number"
        ? totalUnits
        : Array.isArray(units)
        ? units.length
        : 0;

    const propertyBase = {
      landlordId,
      address: address || "",
      nickname: nickname || "",
      unitCount: resolvedUnitCount,
      createdAt,
    };

    try {
      const docRef = await db.collection("properties").add(propertyBase);
      const property = { id: docRef.id, ...propertyBase };
      return res.status(201).json(property);
    } catch (err: any) {
      console.error("[POST /api/properties] failed to write", err);
      return res.status(500).json({
        error: "db_failed",
        message: err?.message || "Failed to create property",
      });
    }
  }
);

/**
 * POST /api/properties/:propertyId/units
 * Updates unitCount on a property record.
 * Requires units.create capability and verifies landlord ownership.
 *
 * Body: { units: any[] }
 */
router.post(
  "/:propertyId/units",
  requireCapability("units.create"),
  enforceUnitCap,
  async (req: any, res) => {
    const landlordId = req.user?.landlordId || req.user?.id;
    if (!landlordId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { propertyId } = req.params;
    const units = Array.isArray(req.body?.units) ? req.body.units : [];
    const unitCount = units.length;

    try {
      const docRef = db.collection("properties").doc(propertyId);
      const doc = await docRef.get();

      if (!doc.exists) {
        return res.status(404).json({ error: "not_found" });
      }

      const data = doc.data() as any;

      // Ownership check
      if (data?.landlordId && data.landlordId !== landlordId) {
        return res.status(403).json({ error: "forbidden" });
      }

      await docRef.update({ unitCount });

      return res.status(200).json({ ok: true, unitCount });
    } catch (err: any) {
      console.error("[POST /api/properties/:propertyId/units] failed", err);
      return res.status(500).json({
        error: "db_failed",
        message: err?.message || "Failed to update unit count",
      });
    }
  }
);

export default router;
