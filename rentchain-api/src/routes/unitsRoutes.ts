import { Router } from "express";
import multer from "multer";
import { db, FieldValue } from "../firebase";
import { authenticateJwt } from "../middleware/authMiddleware";
import { requireCapability } from "../services/capabilityGuard";
import { uploadBufferToGcs } from "../lib/gcs";
import { getSignedDownloadUrl } from "../lib/gcsSignedUrl";

const router = Router();
const leaseDocumentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const name = String(file?.originalname || "").toLowerCase();
    const mime = String(file?.mimetype || "").toLowerCase();
    const allowedMime = new Set([
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "image/jpeg",
      "image/png",
    ]);
    const allowedExtension = [".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png"].some((ext) =>
      name.endsWith(ext)
    );
    if (allowedMime.has(mime) || allowedExtension) {
      return cb(null, true);
    }
    return cb(new Error("Unsupported lease document type"));
  },
});

function requireLandlord(req: any, res: any, next: any) {
  if (!req.user) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }
  const role = String(req.user?.role || "");
  if (role !== "landlord" && role !== "admin") {
    return res.status(403).json({ ok: false, error: "Forbidden" });
  }
  return next();
}

async function enforceUnitsCapability(req: any, res: any): Promise<boolean> {
  const role = String(req.user?.role || "").toLowerCase();
  if (role === "admin") return true;

  const landlordId = req.user?.landlordId || req.user?.id;
  if (!landlordId) {
    res.status(401).json({ ok: false, error: "Unauthorized" });
    return false;
  }
  const cap = await requireCapability(landlordId, "unitsTable", req.user);
  if (!cap.ok) {
    res.status(403).json({ ok: false, error: "Upgrade required", capability: "unitsTable", plan: cap.plan });
    return false;
  }
  return true;
}

async function ensurePropertyReadable(req: any, propertyId: string) {
  const role = String(req.user?.role || "").toLowerCase();
  const landlordId = String(req.user?.landlordId || req.user?.id || "").trim();
  const snap = await db.collection("properties").doc(propertyId).get();
  if (!snap.exists) return { ok: false as const, code: "NOT_FOUND" as const };

  const data = snap.data() as any;
  const propertyLandlordId = String(data?.landlordId || data?.ownerId || data?.owner || "").trim();
  if (role === "admin") {
    return {
      ok: true as const,
      role,
      data,
      landlordId,
      propertyLandlordId: propertyLandlordId || landlordId,
    };
  }

  if (role === "landlord" && landlordId && propertyLandlordId === landlordId) {
    return {
      ok: true as const,
      role,
      data,
      landlordId,
      propertyLandlordId,
    };
  }

  return { ok: false as const, code: "FORBIDDEN" as const };
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

function normalizeStatus(value: any): string {
  return String(value || "").trim().toLowerCase();
}

function isPlaceholderUnitId(value: any): boolean {
  const id = String(value || "").trim();
  return Boolean(id) && /^placeholder-/i.test(id);
}

function optionalNumber(...values: any[]): number | null {
  for (const value of values) {
    if (value === undefined || value === null || value === "") continue;
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function normalizeUnitStatus(...values: any[]): "vacant" | "occupied" {
  for (const value of values) {
    const status = normalizeStatus(value);
    if (["occupied", "leased", "rented"].includes(status)) return "occupied";
    if (["vacant", "available", "empty"].includes(status)) return "vacant";
  }
  return "vacant";
}

function parseUnitStatus(value: any): "vacant" | "occupied" | null {
  const status = normalizeStatus(value);
  if (["occupied", "leased", "rented"].includes(status)) return "occupied";
  if (["vacant", "available", "empty"].includes(status)) return "vacant";
  return null;
}

function normalizeCreateUnitInput(u: any, context: { landlordId: string; propertyId: string; unitNumber: string; now: Date }) {
  const rent = optionalNumber(u?.marketRent, u?.rent, u?.monthlyRent);
  const beds = optionalNumber(u?.beds, u?.bedrooms);
  const baths = optionalNumber(u?.baths, u?.bathrooms);
  const sqft = optionalNumber(u?.sqft, u?.squareFeet);
  const status = normalizeUnitStatus(u?.status, u?.occupancyStatus);
  const occupantName =
    status === "occupied"
      ? String(u?.occupantName || u?.tenantName || "").trim() || null
      : null;
  const leaseEndDate =
    status === "occupied"
      ? String(u?.leaseEndDate || u?.endDate || u?.leaseEnd || "").trim() || null
      : null;

  return {
    landlordId: context.landlordId,
    propertyId: context.propertyId,
    unitNumber: context.unitNumber,
    rent,
    marketRent: rent,
    beds,
    bedrooms: beds,
    baths,
    bathrooms: baths,
    sqft,
    status,
    occupancyStatus: status,
    occupantName,
    tenantName: occupantName,
    leaseEndDate,
    createdAt: context.now,
    updatedAt: context.now,
    updatedAtServer: FieldValue.serverTimestamp(),
  };
}

async function attachSignedLeaseDocument(unit: any) {
  const leaseDocument = unit?.leaseDocument;
  if (!leaseDocument || typeof leaseDocument !== "object") return unit;
  const bucket = String(leaseDocument.bucket || "").trim();
  const path = String(leaseDocument.path || "").trim();
  if (!bucket || !path) return unit;
  try {
    const url = await getSignedDownloadUrl({ bucket, path, expiresMinutes: 30 });
    return {
      ...unit,
      leaseDocument: {
        ...leaseDocument,
        url,
      },
    };
  } catch {
    return unit;
  }
}

function leaseIndicatesSigned(status: any): boolean {
  const normalized = normalizeStatus(status);
  return normalized === "signed" || normalized === "active" || normalized === "current";
}

async function buildInviteEligibilityByUnit(opts: {
  landlordId: string;
  propertyId: string;
  units: any[];
}) {
  const map = new Map<string, { eligible: boolean; reason?: string }>();
  if (!opts.units.length) return map;

  const signedUnits = new Set<string>();
  const signedUnitNumbers = new Set<string>();
  try {
    const leaseSnap = await db
      .collection("leases")
      .where("landlordId", "==", opts.landlordId)
      .limit(400)
      .get();

    leaseSnap.docs.forEach((doc) => {
      const lease = doc.data() as any;
      if (String(lease?.propertyId || "") !== opts.propertyId) return;
      if (!leaseIndicatesSigned(lease?.status)) return;
      const unitId = String(lease?.unitId || "").trim();
      const unitNumber = String(lease?.unitNumber || lease?.unit || "").trim();
      if (unitId) signedUnits.add(unitId);
      if (unitNumber) signedUnitNumbers.add(unitNumber);
    });
  } catch {
    // Keep defaults below if lease lookup fails.
  }

  opts.units.forEach((unit) => {
    const unitId = String(unit?.id || unit?.unitId || "").trim();
    if (!unitId) return;
    const occupancy = normalizeStatus(unit?.occupancyStatus || unit?.status);
    const unitNumber = String(unit?.unitNumber || unit?.label || "").trim();
    const leaseEligible =
      signedUnits.has(unitId) || (unitNumber ? signedUnitNumbers.has(unitNumber) : false);
    const eligible = occupancy === "occupied" || leaseEligible;
    map.set(unitId, eligible ? { eligible: true } : { eligible: false, reason: "lease_required" });
  });

  return map;
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
    if (!(await enforceUnitsCapability(req, res))) return;

    const access = await ensurePropertyReadable(req, propertyId);
    if (!access.ok) {
      if (access.code === "NOT_FOUND") return res.status(404).json({ ok: false, error: "Property not found" });
      return res.status(403).json({ ok: false, error: "Forbidden" });
    }

    const unitsQuery = db.collection("units").where("propertyId", "==", propertyId);
    const snap =
      access.role === "admin"
        ? await unitsQuery.get()
        : await unitsQuery.where("landlordId", "==", landlordId).get();

    const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    const inviteEligibility = await buildInviteEligibilityByUnit({
      landlordId: access.propertyLandlordId || landlordId,
      propertyId,
      units: items,
    });
    const normalizedItems = await Promise.all(items.map(async (item) => {
      const key = String(item?.id || item?.unitId || "").trim();
      const eligibility = inviteEligibility.get(key);
      const baseItem = !eligibility
        ? item
        : {
        ...item,
        inviteEligible: eligibility.eligible,
        inviteEligibilityReason: eligibility.reason || null,
      };
      return attachSignedLeaseDocument(baseItem);
    }));
    normalizedItems.sort((a, b) => String(a.unitNumber || "").localeCompare(String(b.unitNumber || "")));

    const realCount = normalizedItems.length;
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

    return res.json({ ok: true, items: normalizedItems, unitCount: realCount });
  }
);

router.get("/units", authenticateJwt, requireLandlord, async (req: any, res) => {
  res.setHeader("x-route-source", "unitsRoutes");
  const landlordId = req.user?.landlordId || req.user?.id;
  const propertyId = String(req.query?.propertyId || "");
  if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });
  if (!propertyId) return res.status(400).json({ ok: false, error: "Missing propertyId" });
  if (!(await enforceUnitsCapability(req, res))) return;

  const access = await ensurePropertyReadable(req, propertyId);
  if (!access.ok) {
    if (access.code === "NOT_FOUND") return res.status(404).json({ ok: false, error: "Property not found" });
    return res.status(403).json({ ok: false, error: "Forbidden" });
  }

  const unitsQuery = db.collection("units").where("propertyId", "==", propertyId);
  const snap =
    access.role === "admin"
      ? await unitsQuery.get()
      : await unitsQuery.where("landlordId", "==", landlordId).get();

  const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
  const inviteEligibility = await buildInviteEligibilityByUnit({
    landlordId: access.propertyLandlordId || landlordId,
    propertyId,
    units: items,
  });
  const normalizedItems = await Promise.all(items.map(async (item) => {
    const key = String(item?.id || item?.unitId || "").trim();
    const eligibility = inviteEligibility.get(key);
    const baseItem = !eligibility
      ? item
      : {
      ...item,
      inviteEligible: eligibility.eligible,
      inviteEligibilityReason: eligibility.reason || null,
    };
    return attachSignedLeaseDocument(baseItem);
  }));
  normalizedItems.sort((a, b) => String(a.unitNumber || "").localeCompare(String(b.unitNumber || "")));

  const realCount = normalizedItems.length;
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

  return res.json({ ok: true, items: normalizedItems, unitCount: realCount });
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
    if (!(await enforceUnitsCapability(req, res))) return;

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
    const createdUnits: any[] = [];

    for (const u of units) {
      const unitNumber = String((u?.unitNumber ?? u?.label ?? u?.unit) || "").trim();
      if (!unitNumber) continue;

      const ref = db.collection("units").doc();
      const unitRecord = normalizeCreateUnitInput(u, { landlordId, propertyId, unitNumber, now });
      batch.set(ref, unitRecord);
      createdUnits.push({
        id: ref.id,
        ...unitRecord,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        updatedAtServer: null,
      });
      created += 1;
    }

    if (created === 0) {
      return res.status(400).json({ ok: false, error: "No valid units to create" });
    }
    if (createdUnits.some((unit) => !unit.id || isPlaceholderUnitId(unit.id))) {
      return res.status(500).json({
        ok: false,
        error: "UNIT_ID_UNRESOLVED",
        code: "UNIT_ID_UNRESOLVED",
        message: "Units could not be saved with stable IDs. Please try again.",
      });
    }

    try {
      await batch.commit();
    } catch {
      return res.status(500).json({
        ok: false,
        error: "UNIT_PERSISTENCE_FAILED",
        code: "UNIT_PERSISTENCE_FAILED",
        message: "Units could not be saved. Please try again.",
      });
    }

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

    return res.json({ ok: true, created, units: createdUnits, items: createdUnits });
  }
);

router.patch("/units/:unitId", authenticateJwt, requireLandlord, async (req: any, res) => {
  res.setHeader("x-route-source", "unitsRoutes");
  const landlordId = req.user?.landlordId || req.user?.id;
  const unitId = String(req.params?.unitId || "");
  if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });
  if (!unitId) return res.status(400).json({ ok: false, error: "Missing unitId" });
  if (!(await enforceUnitsCapability(req, res))) return;
  if (isPlaceholderUnitId(unitId)) {
    return res.status(400).json({
      ok: false,
      error: "UNIT_ID_UNRESOLVED",
      code: "UNIT_ID_UNRESOLVED",
      message: "Save the unit before updating occupancy fields.",
    });
  }

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

  const {
    unitNumber,
    unit,
    name,
    label,
    rent,
    marketRent,
    beds,
    baths,
    notes,
    status,
    occupancyStatus,
    occupantName,
    tenantName,
    leaseEndDate,
    endDate,
    leaseEnd,
  } = req.body || {};
  const updates: any = {};

  const nextUnitNumber = unitNumber ?? unit ?? name ?? label;
  if (nextUnitNumber !== undefined) {
    updates.unitNumber = String(nextUnitNumber || "").trim();
  }
  const nextRent = rent !== undefined ? rent : marketRent;
  if (nextRent !== undefined) {
    updates.rent = nextRent === null || nextRent === "" ? null : Number(nextRent);
    if (updates.rent !== null && !Number.isFinite(updates.rent)) {
      return res.status(400).json({ ok: false, error: "Invalid rent" });
    }
    updates.marketRent = updates.rent;
  }
  if (beds !== undefined) {
    updates.beds = beds === null || beds === "" ? null : Number(beds);
    if (updates.beds !== null && !Number.isFinite(updates.beds)) {
      return res.status(400).json({ ok: false, error: "Invalid beds" });
    }
    updates.bedrooms = updates.beds;
  }
  if (baths !== undefined) {
    updates.baths = baths === null || baths === "" ? null : Number(baths);
    if (updates.baths !== null && !Number.isFinite(updates.baths)) {
      return res.status(400).json({ ok: false, error: "Invalid baths" });
    }
    updates.bathrooms = updates.baths;
  }
  if (notes !== undefined) {
    updates.notes = notes === null ? null : String(notes);
  }
  const nextStatus = status ?? occupancyStatus;
  if (nextStatus !== undefined) {
    const normalizedStatus = parseUnitStatus(nextStatus);
    if (!normalizedStatus) {
      return res.status(400).json({ ok: false, error: "Invalid status" });
    }
    updates.status = normalizedStatus;
    updates.occupancyStatus = normalizedStatus;
  }
  const nextOccupantName = occupantName ?? tenantName;
  if (nextOccupantName !== undefined) {
    const value = String(nextOccupantName || "").trim();
    updates.occupantName = value || null;
    updates.tenantName = value || null;
  }
  const nextLeaseEndDate = leaseEndDate ?? endDate ?? leaseEnd;
  if (nextLeaseEndDate !== undefined) {
    const value = String(nextLeaseEndDate || "").trim();
    updates.leaseEndDate = value || null;
  }

  updates.updatedAt = new Date();
  updates.updatedAtServer = FieldValue.serverTimestamp ? FieldValue.serverTimestamp() : new Date();

  await ref.set(updates, { merge: true });
  const updated = { id: unitId, ...existing, ...updates };
  return res.json({ ok: true, unit: updated });
});

router.post(
  "/units/:unitId/lease-document",
  authenticateJwt,
  requireLandlord,
  (req, res, next) => leaseDocumentUpload.single("file")(req, res, next),
  async (req: any, res) => {
    const landlordId = req.user?.landlordId || req.user?.id;
    const unitId = String(req.params?.unitId || "");
    if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });
    if (!unitId) return res.status(400).json({ ok: false, error: "Missing unitId" });
    if (!(await enforceUnitsCapability(req, res))) return;

    const ref = db.collection("units").doc(unitId);
    const snap = await ref.get();
    if (!snap.exists) {
      return res.status(404).json({ ok: false, error: "UNIT_NOT_FOUND" });
    }
    const existing = snap.data() as any;
    const propertyId = String(existing?.propertyId || "").trim();
    if (existing?.landlordId !== landlordId) {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }
    if (propertyId) {
      const ownership = await ensurePropertyOwned(propertyId, landlordId);
      if (!ownership.ok) {
        return res.status(403).json({ ok: false, error: "FORBIDDEN" });
      }
    }

    const file = req.file as Express.Multer.File | undefined;
    if (!file?.buffer) {
      return res.status(400).json({ ok: false, error: "lease_document_file_required" });
    }

    const safeName = String(file.originalname || "lease-document").replace(/[^a-zA-Z0-9._-]+/g, "_");
    const path = `units/lease-documents/${landlordId}/${propertyId || "property"}/${unitId}/${Date.now()}_${safeName}`;
    const uploaded = await uploadBufferToGcs({
      path,
      contentType: file.mimetype || "application/octet-stream",
      buffer: file.buffer,
      metadata: {
        landlordId: String(landlordId),
        propertyId,
        unitId,
        originalName: file.originalname || safeName,
      },
    });

    const leaseDocument = {
      fileName: file.originalname || safeName,
      contentType: file.mimetype || "application/octet-stream",
      bucket: uploaded.bucket,
      path: uploaded.path,
      uploadedAt: new Date().toISOString(),
      uploadedByUserId: String(req.user?.id || landlordId),
    };

    await ref.set(
      {
        leaseDocument,
        updatedAt: new Date(),
        updatedAtServer: FieldValue.serverTimestamp ? FieldValue.serverTimestamp() : new Date(),
      },
      { merge: true }
    );

    const url = await getSignedDownloadUrl({
      bucket: uploaded.bucket,
      path: uploaded.path,
      expiresMinutes: 30,
    }).catch(() => null);

    return res.json({
      ok: true,
      unit: {
        id: unitId,
        ...existing,
        leaseDocument: {
          ...leaseDocument,
          url,
        },
      },
    });
  }
);

export default router;
