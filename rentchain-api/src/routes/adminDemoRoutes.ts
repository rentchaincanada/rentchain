import { Router } from "express";
import { db } from "../config/firebase";
import { jsonError } from "../lib/httpResponse";
import { requireLandlord } from "../middleware/requireLandlord";

const router = Router({ mergeParams: true });

function requireAdminOrDev(req: any, res: any, next: any) {
  const ok = req.user?.role === "admin" || process.env.ALLOW_DEMO_ADMIN === "true";
  if (!ok) {
    return jsonError(res, 403, "FORBIDDEN", "Forbidden", undefined, req.requestId);
  }
  return next();
}

async function deleteQueryInBatches(query: FirebaseFirestore.Query, batchSize = 400) {
  let total = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const snap = await query.limit(batchSize).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    total += snap.size;
  }
  return total;
}

async function resetDemoData(params: { landlordId: string; demoKey: string; requestId?: string }) {
  const { landlordId, demoKey } = params;
  const collections = [
    {
      name: "units",
      q: db
        .collection("units")
        .where("landlordId", "==", landlordId)
        .where("isDemo", "==", true)
        .where("demoKey", "==", demoKey),
    },
    {
      name: "properties",
      q: db
        .collection("properties")
        .where("landlordId", "==", landlordId)
        .where("isDemo", "==", true)
        .where("demoKey", "==", demoKey),
    },
  ];

  const deleted: Record<string, number> = {};
  for (const c of collections) {
    deleted[c.name] = await deleteQueryInBatches(c.q);
  }
  return deleted;
}

async function seedDemoData(params: { landlordId: string; demoKey: string; unitsCount?: number }) {
  const { landlordId, demoKey } = params;
  const units = Number.isFinite(params.unitsCount)
    ? Math.max(0, Math.min(Number(params.unitsCount), 10))
    : 5;

  const propRef = db.collection("properties").doc();
  const propertyId = propRef.id;

  await propRef.set({
    landlordId,
    isDemo: true,
    demoKey,
    name: "Demo Property",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const rows: Array<{ unitNumber: string; rent: number; bedrooms: number; bathrooms: number; sqft: number }> = [];
  for (let i = 0; i < units; i++) {
    const unitNumber = String(101 + i);
    rows.push({
      unitNumber,
      rent: 1650 + i * 25,
      bedrooms: i % 3,
      bathrooms: 1,
      sqft: 500 + i * 15,
    });
  }

  let createdUnits = 0;
  const batchSize = 400;
  let idx = 0;
  while (idx < rows.length) {
    const batch = db.batch();
    const chunk = rows.slice(idx, idx + batchSize);
    for (const r of chunk) {
      const unitRef = db.collection("units").doc();
      batch.set(unitRef, {
        landlordId,
        propertyId,
        isDemo: true,
        demoKey,
        ...r,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      createdUnits++;
    }
    await batch.commit();
    idx += chunk.length;
  }

  return { propertyId, createdUnits };
}

router.post("/reset", requireLandlord, requireAdminOrDev, async (req: any, res: any) => {
  const requestId = req.requestId;
  const landlordId = req.user?.landlordId || req.user?.id;
  const demoKey = String(req.body?.demoKey || landlordId).trim();

  if (!landlordId) return jsonError(res, 401, "UNAUTHORIZED", "Unauthorized", undefined, requestId);

  const deleted = await resetDemoData({ landlordId, demoKey, requestId });
  return res.json({ ok: true, demoKey, deleted });
});

router.post("/seed", requireLandlord, requireAdminOrDev, async (req: any, res: any) => {
  const requestId = req.requestId;
  const landlordId = req.user?.landlordId || req.user?.id;
  const demoKey = String(req.body?.demoKey || landlordId).trim();
  const units = Number(req.body?.units ?? 5);

  if (!landlordId) return jsonError(res, 401, "UNAUTHORIZED", "Unauthorized", undefined, requestId);

  const seeded = await seedDemoData({ landlordId, demoKey, unitsCount: units });
  return res.json({ ok: true, demoKey, seeded });
});

router.post("/reset-and-seed", requireLandlord, requireAdminOrDev, async (req: any, res: any) => {
  const requestId = req.requestId;
  const landlordId = req.user?.landlordId || req.user?.id;
  const demoKey = String(req.body?.demoKey || landlordId).trim();
  const units = Number(req.body?.units ?? 5);

  if (!landlordId) return jsonError(res, 401, "UNAUTHORIZED", "Unauthorized", undefined, requestId);

  const deleted = await resetDemoData({ landlordId, demoKey, requestId });
  const seeded = await seedDemoData({ landlordId, demoKey, unitsCount: units });

  return res.json({ ok: true, demoKey, deleted, seeded });
});

export default router;
