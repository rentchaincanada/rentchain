import { Router } from "express";
import { db, FieldValue } from "../config/firebase";
import { authenticateJwt } from "../middleware/authMiddleware";

const router = Router();

function requireLandlord(req: any, res: any, next: any) {
  const role = String(req.user?.role || "");
  if (role !== "landlord" && role !== "admin") {
    return res.status(403).json({ ok: false, error: "Forbidden" });
  }
  return next();
}

async function ensurePropertyOwned(propertyId: string, landlordId: string) {
  const snap = await db.collection("properties").doc(propertyId).get();
  if (!snap.exists) return { ok: false as const, code: "NOT_FOUND" as const };
  const data = snap.data() as any;
  if ((data?.landlordId || data?.ownerId || data?.owner) !== landlordId) {
    return { ok: false as const, code: "FORBIDDEN" as const };
  }
  return { ok: true as const, data };
}

router.get(
  "/properties/:propertyId/units",
  authenticateJwt,
  requireLandlord,
  async (req: any, res) => {
    res.setHeader("x-route-source", "unitsRoutes");
    const landlordId = req.user?.landlordId || req.user?.id;
    const propertyId = String(req.params.propertyId || "");
    if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });
    if (!propertyId) return res.status(400).json({ ok: false, error: "Missing propertyId" });

    const ownership = await ensurePropertyOwned(propertyId, landlordId);
    if (!ownership.ok) {
      if (ownership.code === "NOT_FOUND") return res.status(404).json({ ok: false, error: "Property not found" });
      return res.status(403).json({ ok: false, error: "Forbidden" });
    }

    const snap = await db
      .collection("units")
      .where("landlordId", "==", landlordId)
      .where("propertyId", "==", propertyId)
      .get();

    const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    items.sort((a, b) => String(a.unitNumber || "").localeCompare(String(b.unitNumber || "")));

    const realCount = items.length;
    try {
      const propRef = db.collection("properties").doc(propertyId);
      const propSnap = await propRef.get();
      if (propSnap.exists) {
        const current = Number((propSnap.data() as any)?.unitCount ?? 0) || 0;
        if (current !== realCount) {
          await propRef.set(
            {
              unitCount: realCount,
              unitsCount: realCount,
              updatedAt: FieldValue.serverTimestamp ? FieldValue.serverTimestamp() : new Date().toISOString(),
            },
            { merge: true }
          );
        }
      }
    } catch {
      // ignore sync errors
    }

    return res.json({ ok: true, items, unitCount: realCount });
  }
);

router.get("/units", authenticateJwt, requireLandlord, async (req: any, res) => {
  res.setHeader("x-route-source", "unitsRoutes");
  const landlordId = req.user?.landlordId || req.user?.id;
  const propertyId = String(req.query?.propertyId || "");
  if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });
  if (!propertyId) return res.status(400).json({ ok: false, error: "Missing propertyId" });

  const ownership = await ensurePropertyOwned(propertyId, landlordId);
  if (!ownership.ok) {
    if (ownership.code === "NOT_FOUND") return res.status(404).json({ ok: false, error: "Property not found" });
    return res.status(403).json({ ok: false, error: "Forbidden" });
  }

  const snap = await db
    .collection("units")
    .where("landlordId", "==", landlordId)
    .where("propertyId", "==", propertyId)
    .get();

  const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
  items.sort((a, b) => String(a.unitNumber || "").localeCompare(String(b.unitNumber || "")));

  const realCount = items.length;
  try {
    const propRef = db.collection("properties").doc(propertyId);
    const propSnap = await propRef.get();
    if (propSnap.exists) {
      const current = Number((propSnap.data() as any)?.unitCount ?? 0) || 0;
      if (current !== realCount) {
        await propRef.set(
          {
            unitCount: realCount,
            unitsCount: realCount,
            updatedAt: FieldValue.serverTimestamp ? FieldValue.serverTimestamp() : new Date().toISOString(),
          },
          { merge: true }
        );
      }
    }
  } catch {
    // ignore sync errors
  }

  return res.json({ ok: true, items, unitCount: realCount });
});

router.post(
  "/properties/:propertyId/units",
  authenticateJwt,
  requireLandlord,
  async (req: any, res) => {
    res.setHeader("x-route-source", "unitsRoutes");
    const landlordId = req.user?.landlordId || req.user?.id;
    const propertyId = String(req.params.propertyId || "");
    if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });
    if (!propertyId) return res.status(400).json({ ok: false, error: "Missing propertyId" });

    const ownership = await ensurePropertyOwned(propertyId, landlordId);
    if (!ownership.ok) {
      if (ownership.code === "NOT_FOUND") return res.status(404).json({ ok: false, error: "Property not found" });
      return res.status(403).json({ ok: false, error: "Forbidden" });
    }

    const units = Array.isArray(req.body?.units) ? req.body.units : [];
    if (!units.length) return res.status(400).json({ ok: false, error: "No units provided" });

    let created = 0;
    const batch = db.batch();
    const now = new Date();

    for (const u of units) {
      const unitNumber = String((u?.unitNumber ?? u?.label ?? u?.unit) || "").trim();
      if (!unitNumber) continue;

      const ref = db.collection("units").doc();
      batch.set(ref, {
        landlordId,
        propertyId,
        unitNumber,
        beds: typeof u?.beds === "number" ? u.beds : null,
        baths: typeof u?.baths === "number" ? u.baths : null,
        sqft: typeof u?.sqft === "number" ? u.sqft : null,
        marketRent: typeof u?.marketRent === "number" ? u.marketRent : null,
        status: (u as any)?.status || "vacant",
        createdAt: now,
        updatedAt: now,
        updatedAtServer: FieldValue.serverTimestamp(),
      });
      created += 1;
    }

    if (created === 0) {
      return res.status(400).json({ ok: false, error: "No valid units to create" });
    }

    await batch.commit();

    try {
      const countSnap = await db
        .collection("units")
        .where("landlordId", "==", landlordId)
        .where("propertyId", "==", propertyId)
        .get();
      await db.collection("properties").doc(propertyId).set(
        {
          unitsCount: countSnap.size,
          updatedAt: now.toISOString(),
          updatedAtServer: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    } catch {
      // ignore count update errors
    }

    return res.json({ ok: true, created });
  }
);

router.patch("/units/:unitId", authenticateJwt, requireLandlord, async (req: any, res) => {
  res.setHeader("x-route-source", "unitsRoutes");
  const landlordId = req.user?.landlordId || req.user?.id;
  const unitId = String(req.params?.unitId || "");
  if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });
  if (!unitId) return res.status(400).json({ ok: false, error: "Missing unitId" });

  const ref = db.collection("units").doc(unitId);
  const snap = await ref.get();
  if (!snap.exists) {
    return res.status(404).json({ ok: false, error: "UNIT_NOT_FOUND" });
  }
  const existing = snap.data() as any;
  const propertyId = existing?.propertyId;
  if (existing?.landlordId !== landlordId) {
    return res.status(403).json({ ok: false, error: "FORBIDDEN" });
  }
  if (propertyId) {
    const ownership = await ensurePropertyOwned(String(propertyId), landlordId);
    if (!ownership.ok) {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }
  }

  const { unitNumber, rent, beds, baths, notes, status } = req.body || {};
  const updates: any = {};

  if (unitNumber !== undefined) {
    updates.unitNumber = String(unitNumber || "").trim();
  }
  if (rent !== undefined) {
    updates.rent = rent === null || rent === "" ? null : Number(rent);
    if (updates.rent !== null && !Number.isFinite(updates.rent)) {
      return res.status(400).json({ ok: false, error: "Invalid rent" });
    }
  }
  if (beds !== undefined) {
    updates.beds = beds === null || beds === "" ? null : Number(beds);
    if (updates.beds !== null && !Number.isFinite(updates.beds)) {
      return res.status(400).json({ ok: false, error: "Invalid beds" });
    }
  }
  if (baths !== undefined) {
    updates.baths = baths === null || baths === "" ? null : Number(baths);
    if (updates.baths !== null && !Number.isFinite(updates.baths)) {
      return res.status(400).json({ ok: false, error: "Invalid baths" });
    }
  }
  if (notes !== undefined) {
    updates.notes = notes === null ? null : String(notes);
  }
  if (status !== undefined) {
    const valid = ["vacant", "occupied"];
    if (!valid.includes(String(status))) {
      return res.status(400).json({ ok: false, error: "Invalid status" });
    }
    updates.status = String(status);
  }

  updates.updatedAt = new Date();
  updates.updatedAtServer = FieldValue.serverTimestamp ? FieldValue.serverTimestamp() : new Date();

  await ref.set(updates, { merge: true });
  const updated = { id: unitId, ...existing, ...updates };
  return res.json({ ok: true, unit: updated });
});

export default router;
