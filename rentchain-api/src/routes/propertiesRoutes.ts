// rentchain-api/src/routes/propertiesRoutes.ts
import { Router } from "express";
import { requireCapability } from "../entitlements/entitlements.middleware";
import { enforcePropertyCap, enforceUnitCap } from "../entitlements/limits.middleware";
import { db, FieldValue } from "../config/firebase";

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

    const propertyRef = db.collection("properties").doc();
    const propertyBase = {
      landlordId,
      address: address || "",
      nickname: nickname || "",
      unitCount: resolvedUnitCount,
      createdAt,
    };

    try {
      await db.runTransaction(async (tx) => {
        tx.set(propertyRef, propertyBase);
        const usageRef = db.collection("landlordUsage").doc(landlordId);
        tx.set(
          usageRef,
          {
            properties: FieldValue.increment(1),
            units: FieldValue.increment(resolvedUnitCount || 0),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      });

      const property = { id: propertyRef.id, ...propertyBase };
      try {
        const { emitLedgerEventV2 } = await import(
          "../services/ledgerEventsFirestoreService"
        );
        await emitLedgerEventV2({
          landlordId,
          eventType: "PROPERTY_CREATED",
          title: "Property created",
          propertyId: propertyRef.id,
          actor: { type: "LANDLORD", userId: landlordId, email: req.user?.email },
          occurredAt: Date.now(),
        });
      } catch (e) {
        console.warn("[ledger-v2] failed to emit property event", (e as any)?.message || e);
      }
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

      const previousCount = Number(data?.unitCount ?? 0);
      const delta = unitCount - previousCount;

      await db.runTransaction(async (tx) => {
        tx.update(docRef, { unitCount });
        if (delta !== 0) {
          const usageRef = db.collection("landlordUsage").doc(landlordId);
          tx.set(
            usageRef,
            {
              units: FieldValue.increment(delta),
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        }
      });

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
