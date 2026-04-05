// rentchain-api/src/routes/propertiesRoutes.ts
import { Router } from "express";
import { requireCapability } from "../entitlements/entitlements.middleware";
import { db, FieldValue } from "../config/firebase";
import { normalizeProvince } from "../lib/province";
import { ensureRegistrySource } from "../services/registry/registryImportService";
import { getPropertyRegistryProjection, upsertPropertyRegistryProjection } from "../services/registry/registryStatusProjectionService";
import {
  buildHalifaxRegistrySubmissionExportPayload,
  HALIFAX_FIELD_MAP,
  loadHalifaxRegistrySubmissionDraft,
  markHalifaxRegistrySubmissionExported,
  saveHalifaxRegistrySubmissionDraft,
} from "../services/registry/halifaxRegistrySubmissionService";
import { normalizePid } from "../services/registry/registryUtils";

const router = Router();

function normalize(value: any) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s]/g, "");
}

function firstString(...values: any[]) {
  for (const v of values) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function resolvePropertyPidLikeValue(property: Record<string, any>) {
  const metadata = property?.metadata && typeof property.metadata === "object" ? property.metadata : {};
  return (
    normalizePid(property?.pid) ||
    normalizePid(property?.PID) ||
    normalizePid(property?.propertyPid) ||
    normalizePid(property?.parcelId) ||
    normalizePid(property?.parcelPid) ||
    normalizePid((metadata as any)?.pid) ||
    normalizePid((metadata as any)?.propertyPid) ||
    normalizePid((metadata as any)?.parcelId) ||
    null
  );
}

function sanitizePidInput(value: any) {
  if (value === undefined) return { ok: true as const, value: undefined };
  if (value === null) return { ok: true as const, value: null };
  const normalized = String(value).trim().toUpperCase();
  if (!normalized) return { ok: true as const, value: null };
  if (!/^[A-Z0-9_-]+$/.test(normalized)) {
    return {
      ok: false as const,
      error: "invalid_pid",
      message: "PID may only include letters, numbers, hyphens, and underscores.",
    };
  }
  if (normalized.length > 64) {
    return {
      ok: false as const,
      error: "invalid_pid",
      message: "PID must be 64 characters or fewer.",
    };
  }
  return { ok: true as const, value: normalized };
}

function resolveIncomingPid(body: Record<string, any>) {
  return body.pid ?? body.PID ?? body.propertyPid ?? body.parcelId ?? body.parcelPid ?? body?.metadata?.pid;
}

function normalizePropertyForResponse<T extends Record<string, any>>(property: T): T & { pid?: string | null } {
  const pid = resolvePropertyPidLikeValue(property);
  return (pid && !property?.pid ? { ...property, pid } : property) as T & { pid?: string | null };
}

function makeAddressKeyFromParts(street: string, city: string, province: string, postal: string) {
  const streetKey = normalize(street);
  const cityKey = normalize(city);
  const provinceKey = normalize(province);
  const postalKey = normalize(postal);
  return [streetKey, cityKey, provinceKey, postalKey].filter(Boolean).join("|");
}

function normalizeUnits(units: any[]): Array<{
  unitNumber: string;
  rent: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number | null;
}> {
  return (Array.isArray(units) ? units : [])
    .map((u) => {
      const unitNumber = String(u?.unitNumber ?? u?.unit ?? u?.label ?? "").trim();
      if (!unitNumber) return null;
      const rentRaw = u?.rent ?? u?.marketRent ?? u?.monthlyRent ?? null;
      const bedroomsRaw = u?.bedrooms ?? u?.beds ?? null;
      const bathroomsRaw = u?.bathrooms ?? u?.baths ?? null;
      const sqftRaw = u?.sqft ?? u?.squareFeet ?? null;
      return {
        unitNumber,
        rent: Number.isFinite(Number(rentRaw)) ? Number(rentRaw) : null,
        bedrooms: Number.isFinite(Number(bedroomsRaw)) ? Number(bedroomsRaw) : null,
        bathrooms: Number.isFinite(Number(bathroomsRaw)) ? Number(bathroomsRaw) : null,
        sqft: Number.isFinite(Number(sqftRaw)) ? Number(sqftRaw) : null,
      };
    })
    .filter(Boolean) as Array<{
      unitNumber: string;
      rent: number | null;
      bedrooms: number | null;
      bathrooms: number | null;
      sqft: number | null;
    }>;
}

function parseScreeningRequiredBeforeApproval(input: any, fallback = true): boolean {
  if (typeof input === "boolean") return input;
  if (typeof input === "string") {
    const normalized = input.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return fallback;
}

function normalizePortfolioStatus(input: any): "active" | "archived" {
  return String(input || "").trim().toLowerCase() === "archived" ? "archived" : "active";
}

function isAdminRole(req: any): boolean {
  return String(req.user?.role || "").toLowerCase() === "admin";
}

function resolveLandlordId(req: any): string {
  return String(req.user?.landlordId || req.user?.id || "").trim();
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

function isManagedByUser(item: any, userId: string): boolean {
  const managerIds = Array.isArray(item?.managerUserIds) ? item.managerUserIds.map((value: any) => String(value || "").trim()) : [];
  return managerIds.includes(userId);
}

function isOwnedOrManagedByUser(item: any, userId: string, landlordId: string): boolean {
  const ownerUserId = String(item?.ownerUserId || "").trim();
  const legacyLandlordId = String(item?.landlordId || "").trim();
  return ownerUserId === userId || legacyLandlordId === landlordId || isManagedByUser(item, userId);
}

async function loadScopedPropertiesForUser(options: {
  userId: string;
  landlordId: string;
  limit: number;
}): Promise<any[]> {
  const ownedByUserQuery = db.collection("properties").where("ownerUserId", "==", options.userId).get();
  const managedByUserQuery = db.collection("properties").where("managerUserIds", "array-contains", options.userId).get();
  const legacyLandlordQuery = db.collection("properties").where("landlordId", "==", options.landlordId).get();

  const [ownedByUserSnap, managedByUserSnap, legacyLandlordSnap] = await Promise.all([
    ownedByUserQuery,
    managedByUserQuery,
    legacyLandlordQuery,
  ]);

  return uniqueById(
    [ownedByUserSnap, managedByUserSnap, legacyLandlordSnap]
      .flatMap((snap: any) => snap.docs || [])
      .map((doc: any) => normalizePropertyForResponse({ id: doc.id, ...(doc.data() as any) }))
  )
    .sort((a: any, b: any) => String(b?.createdAt || "").localeCompare(String(a?.createdAt || "")))
    .slice(0, options.limit);
}

async function loadPropertyOr404(propertyId: string) {
  const snap = await db.collection("properties").doc(propertyId).get();
  if (!snap.exists) return null;
  return normalizePropertyForResponse({ id: snap.id, ...(snap.data() || {}) }) as any;
}
/**
 * GET /api/properties
 * Returns properties for the authenticated landlord.
 */
router.get("/", async (req: any, res) => {
  const role = String(req.user?.role || "").toLowerCase();
  const userId = String(req.user?.id || "").trim();
  const landlordId = resolveLandlordId(req);
  const statusFilter = String(req.query?.status || "").trim().toLowerCase();
  const includeArchived =
    String(req.query?.includeArchived || "")
      .trim()
      .toLowerCase() === "true" || String(req.query?.includeArchived || "").trim() === "1";
  if (!userId || !landlordId) return res.status(401).json({ error: "Unauthorized" });

  res.setHeader("x-route-source", "propertiesRoutes");

  try {
    const limitRaw = Number(req.query?.limit ?? 50);
    const limit =
      Number.isFinite(limitRaw) && limitRaw > 0
        ? Math.min(Math.max(limitRaw, 1), 200)
        : 50;

    const scopedItems = await loadScopedPropertiesForUser({ userId, landlordId, limit });
    const mineItems = scopedItems.filter((item) => isOwnedOrManagedByUser(item, userId, landlordId));

    const filteredItems = mineItems.filter((item: any) => {
      const portfolioStatus = normalizePortfolioStatus(item?.portfolioStatus);
      if (statusFilter === "archived") return portfolioStatus === "archived";
      if (statusFilter === "active") return portfolioStatus === "active";
      if (includeArchived) return true;
      return portfolioStatus === "active";
    });

    console.info("[properties.scope]", {
      route: "/api/properties",
      userId,
      role,
      returnedPropertyCount: filteredItems.length,
      adminOverridePathUsed: false,
    });

    return res.json({ items: filteredItems, nextCursor: null });
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
 */
router.post(
  "/",
  requireCapability("properties.create"),
  async (req: any, res) => {
    const requestId =
      String(req.headers["x-request-id"] || req.headers["x-requestid"] || req.headers["x-correlation-id"] || "")
        .trim() || `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const landlordId = req.user?.landlordId || req.user?.id;
    if (!landlordId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (process.env.NODE_ENV !== "production") {
      console.log("[POST /api/properties] requestId=", requestId);
      console.log("[POST /api/properties] landlordId=", landlordId);
    }

    const {
      address,
      nickname,
      name,
      pid: _canonicalPid,
      addressLine1,
      addressLine2,
      city,
      province,
      postalCode,
      country,
      unitCount,
      totalUnits,
      units,
    } = req.body ?? {};
    const pidInput = sanitizePidInput(resolveIncomingPid(req.body ?? {}));
    if (!pidInput.ok) {
      return res.status(400).json({
        error: pidInput.error,
        message: pidInput.message,
      });
    }
    const addressObj =
      typeof address === "object" && address !== null ? address : req.body?.location || {};
    const resolvedAddressLine1 = firstString(
      addressLine1,
      typeof address === "string" ? address : "",
      addressObj?.line1,
      addressObj?.line_1,
      addressObj?.addressLine1,
      addressObj?.street,
      req.body?.street,
      req.body?.address1
    );
    const resolvedAddressLine2 = firstString(
      addressLine2,
      addressObj?.line2,
      addressObj?.line_2,
      addressObj?.addressLine2,
      addressObj?.unit,
      addressObj?.suite,
      req.body?.address2
    );
    const resolvedCity = firstString(city, addressObj?.city);
    const resolvedProvinceRaw = firstString(province, addressObj?.province, addressObj?.state);
    const resolvedProvince = normalizeProvince(resolvedProvinceRaw);
    const resolvedPostalCode = firstString(postalCode, addressObj?.postalCode, addressObj?.zip);
    const resolvedCountry = firstString(country, addressObj?.country) || "Canada";
    const createdAt = new Date().toISOString();
    const addressKey = makeAddressKeyFromParts(
      resolvedAddressLine1,
      resolvedCity,
      resolvedProvince || "",
      resolvedPostalCode
    );
    if (!resolvedAddressLine1) {
      return res.status(400).json({
        error: "missing_address",
        message: "addressLine1 is required to create a property.",
      });
    }
    if (!resolvedProvince) {
      return res.status(400).json({
        error: "invalid_province",
        message: "province must be a supported Canadian province code.",
      });
    }

    const normalizedUnits = normalizeUnits(units);
    const submittedUnitsCount = Array.isArray(units) ? units.length : 0;
    const resolvedUnitCount =
      normalizedUnits.length > 0
        ? normalizedUnits.length
        : submittedUnitsCount > 0
        ? submittedUnitsCount
        : typeof unitCount === "number"
        ? unitCount
        : typeof totalUnits === "number"
        ? totalUnits
        : 0;

    if (addressKey) {
      try {
        const dupSnap = await db
          .collection("properties")
          .where("landlordId", "==", landlordId)
          .where("addressKey", "==", addressKey)
          .limit(1)
          .get();
        if (!dupSnap.empty) {
          const existingId = dupSnap.docs[0].id;
          return res.status(409).json({
            ok: false,
            code: "PROPERTY_EXISTS",
            message: "Property already exists",
            existingId,
          });
        }
      } catch (e) {
        console.warn("[POST /api/properties] duplicate check failed", (e as any)?.message || e);
      }
    }

    const propertyRef = db.collection("properties").doc();
    const propertyBase = {
      landlordId,
      name: name || nickname || resolvedAddressLine1 || "",
      nickname: nickname || "",
      address: resolvedAddressLine1,
      addressLine1: resolvedAddressLine1,
      addressLine2: resolvedAddressLine2,
      city: resolvedCity,
      province: resolvedProvince,
      postalCode: resolvedPostalCode,
      country: resolvedCountry,
      pid: pidInput.value ?? null,
      unitCount: resolvedUnitCount,
      unitsCount: resolvedUnitCount,
      totalUnits: resolvedUnitCount,
      status: "DRAFT",
      screeningRequiredBeforeApproval: parseScreeningRequiredBeforeApproval(
        (req.body ?? {})?.screeningRequiredBeforeApproval,
        true
      ),
      portfolioStatus: "active",
      archivedAt: null,
      archivedByUserId: null,
      publishedAt: null,
      createdAt,
      updatedAt: createdAt,
      addressKey: addressKey || null,
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

      if (process.env.NODE_ENV !== "production") {
        console.log(
          "[create property] unitsCount=",
          normalizedUnits.length,
          "submittedUnits=",
          submittedUnitsCount,
          "propertyId=",
          propertyRef.id,
          "requestId=",
          requestId
        );
        console.log(
          "[create property] addressLine1=",
          resolvedAddressLine1,
          "landlordId=",
          landlordId,
          "requestId=",
          requestId
        );
      }

      if (normalizedUnits.length > 0) {
        const batch = db.batch();
        const now = new Date();
        for (const unit of normalizedUnits) {
          const unitRef = db.collection("units").doc();
          batch.set(unitRef, {
            landlordId,
            propertyId: propertyRef.id,
            unitNumber: unit.unitNumber,
            rent: unit.rent,
            bedrooms: unit.bedrooms,
            bathrooms: unit.bathrooms,
            sqft: unit.sqft,
            status: "vacant",
            createdAt: now,
            updatedAt: now,
            updatedAtServer: FieldValue.serverTimestamp(),
          });
        }
        try {
          await batch.commit();
          if (process.env.NODE_ENV !== "production") {
            console.log(
              "[create property] units write success propertyId=",
              propertyRef.id,
              "requestId=",
              requestId
            );
          }
        } catch (err: any) {
          console.error("[POST /api/properties] failed to write units", err);
          return res.status(500).json({
            error: "units_write_failed",
            message: err?.message || "Failed to create units",
            requestId,
          });
        }
      }

      const property = normalizePropertyForResponse({
        id: propertyRef.id,
        propertyId: propertyRef.id,
        ...propertyBase,
      });
      if (process.env.NODE_ENV !== "production") {
        console.log(
          "[create property] property write success propertyId=",
          propertyRef.id,
          "requestId=",
          requestId
        );
      }
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
      console.error("[POST /api/properties] failed to write", err, "requestId=", requestId);
      return res.status(500).json({
        error: "db_failed",
        message: err?.message || "Failed to create property",
        requestId,
      });
    }
  }
);

/**
 * PATCH /api/properties/:propertyId
 * Updates editable property fields and automation toggle fields.
 */
router.patch("/:propertyId", async (req: any, res) => {
  const roleAdmin = isAdminRole(req);
  const landlordId = resolveLandlordId(req);
  const propertyId = String(req.params?.propertyId || "").trim();

  if (!propertyId) return res.status(400).json({ ok: false, error: "property_id_required" });
  if (!roleAdmin && !landlordId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const ref = db.collection("properties").doc(propertyId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ ok: false, error: "not_found" });

    const current = (snap.data() || {}) as any;
    const ownerLandlordId = String(current?.landlordId || "").trim();
    if (!roleAdmin && ownerLandlordId !== landlordId) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }

    const body = (req.body && typeof req.body === "object" ? req.body : {}) as any;
    const updates: any = {};
    const stringFields = [
      "name",
      "nickname",
      "address",
      "addressLine1",
      "addressLine2",
      "city",
      "province",
      "postalCode",
      "country",
    ];

    for (const field of stringFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field] === null ? null : String(body[field]).trim();
      }
    }

    const pidInput = sanitizePidInput(resolveIncomingPid(body));
    if (!pidInput.ok) {
      return res.status(400).json({ ok: false, error: pidInput.error, message: pidInput.message });
    }
    if (pidInput.value !== undefined) {
      updates.pid = pidInput.value;
    }

    if (body.screeningRequiredBeforeApproval !== undefined) {
      updates.screeningRequiredBeforeApproval = parseScreeningRequiredBeforeApproval(
        body.screeningRequiredBeforeApproval,
        true
      );
    }

    if (Object.keys(updates).length === 0) {
      return res.json({ ok: true, property: normalizePropertyForResponse({ id: propertyId, ...current }) });
    }

    updates.updatedAt = new Date().toISOString();
    updates.updatedAtServer = FieldValue.serverTimestamp();

    await ref.set(updates, { merge: true });
    return res.json({
      ok: true,
      property: normalizePropertyForResponse({ id: propertyId, ...current, ...updates }),
    });
  } catch (err: any) {
    console.error("[PATCH /api/properties/:propertyId] failed", err);
    return res.status(500).json({
      ok: false,
      error: "db_failed",
      message: err?.message || "Failed to update property",
    });
  }
});

router.get("/:propertyId/registry-status", async (req: any, res) => {
  const roleAdmin = isAdminRole(req);
  const landlordId = resolveLandlordId(req);
  const propertyId = String(req.params?.propertyId || "").trim();

  if (!propertyId) return res.status(400).json({ ok: false, error: "property_id_required" });
  if (!roleAdmin && !landlordId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const property = await loadPropertyOr404(propertyId);
    if (!property) return res.status(404).json({ ok: false, error: "not_found" });
    const ownerLandlordId = String(property?.landlordId || "").trim();
    if (!roleAdmin && ownerLandlordId !== landlordId) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }

    const { source } = await ensureRegistrySource("halifax_r400");
    const propertyProvince = String(property?.province || "").trim().toUpperCase();
    const coverageAvailable = propertyProvince === source.jurisdictionProvince.toUpperCase();
    if (!coverageAvailable) {
      const propertyPid = resolvePropertyPidLikeValue(property);
      return res.json({
        ok: true,
        status: null,
        source: {
          sourceKey: source.sourceKey,
          sourceLabel: source.sourceLabel,
          jurisdictionProvince: source.jurisdictionProvince,
          jurisdictionMunicipality: source.jurisdictionMunicipality,
        },
        coverage: {
          available: false,
          message: "Registry intelligence is currently available for Halifax properties only.",
        },
        pidPrompt: {
          propertyPid: propertyPid || null,
          propertyPidMissing: !propertyPid,
          registryPid: null,
          registryPidAvailable: false,
          pidPromptEligible: false,
          pidPromptMessage: null,
          sourceLabel: source.sourceLabel,
          actionable: false,
        },
      });
    }
    let projection = await getPropertyRegistryProjection({ propertyId, source });
    if (!projection) {
      projection = await upsertPropertyRegistryProjection({
        propertyId,
        source,
        match: null,
        record: null,
      });
    }

    const propertyPid = resolvePropertyPidLikeValue(property);
    const registryPid = projection?.pid || null;
    const propertyPidMissing = !propertyPid;
    const registryPidAvailable = Boolean(registryPid);
    const pidPromptEligible = Boolean(
      coverageAvailable &&
        propertyPidMissing &&
        registryPidAvailable &&
        projection?.registryRecordId
    );
    const pidPromptMessage = pidPromptEligible
      ? "Property PID missing; registry record includes PID. Adding it can improve registry verification and future matching."
      : null;

    return res.json({
      ok: true,
      status: projection,
      source: {
        sourceKey: source.sourceKey,
        sourceLabel: source.sourceLabel,
        jurisdictionProvince: source.jurisdictionProvince,
        jurisdictionMunicipality: source.jurisdictionMunicipality,
      },
      coverage: {
        available: true,
        message: null,
      },
      pidPrompt: {
        propertyPid: propertyPid || null,
        propertyPidMissing,
        registryPid: registryPid || null,
        registryPidAvailable,
        pidPromptEligible,
        pidPromptMessage,
        sourceLabel: source.sourceLabel,
        actionable: pidPromptEligible,
      },
    });
  } catch (err: any) {
    console.error("[GET /api/properties/:propertyId/registry-status] failed", err);
    return res.status(500).json({
      ok: false,
      error: "registry_status_failed",
      message: err?.message || "Failed to load property registry status",
    });
  }
});

router.get("/:propertyId/registry-submission/halifax", async (req: any, res) => {
  const roleAdmin = isAdminRole(req);
  const landlordId = resolveLandlordId(req);
  const propertyId = String(req.params?.propertyId || "").trim();

  if (!propertyId) return res.status(400).json({ ok: false, error: "property_id_required" });
  if (!roleAdmin && !landlordId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const property = await loadPropertyOr404(propertyId);
    if (!property) return res.status(404).json({ ok: false, error: "not_found" });
    const ownership = ensurePropertyOwnership({ req, property, landlordId, roleAdmin });
    if (!ownership.ok) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }

    const submission = await loadHalifaxRegistrySubmissionDraft({
      property: { id: propertyId, ...property },
      landlordId: ownership.ownerLandlordId || landlordId,
    });

    return res.json({
      ok: true,
      submission,
      fieldMap: HALIFAX_FIELD_MAP,
    });
  } catch (err: any) {
    console.error("[GET /api/properties/:propertyId/registry-submission/halifax] failed", err);
    return res.status(500).json({
      ok: false,
      error: "registry_submission_failed",
      message: err?.message || "Failed to load Halifax registry submission assistant",
    });
  }
});

router.put("/:propertyId/registry-submission/halifax", async (req: any, res) => {
  const roleAdmin = isAdminRole(req);
  const landlordId = resolveLandlordId(req);
  const propertyId = String(req.params?.propertyId || "").trim();

  if (!propertyId) return res.status(400).json({ ok: false, error: "property_id_required" });
  if (!roleAdmin && !landlordId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const property = await loadPropertyOr404(propertyId);
    if (!property) return res.status(404).json({ ok: false, error: "not_found" });
    const ownership = ensurePropertyOwnership({ req, property, landlordId, roleAdmin });
    if (!ownership.ok) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }

    const submission = await saveHalifaxRegistrySubmissionDraft({
      property: { id: propertyId, ...property },
      landlordId: ownership.ownerLandlordId || landlordId,
      actorUserId: String(req.user?.id || "").trim() || null,
      actorEmail: String(req.user?.email || "").trim() || null,
      fieldValues: req.body?.fieldValues || {},
      fieldMeta: req.body?.fieldMeta || {},
      declarations: req.body?.declarations || {},
      consent: req.body?.consent || {},
      status: req.body?.status || null,
    });

    return res.json({
      ok: true,
      submission,
      fieldMap: HALIFAX_FIELD_MAP,
    });
  } catch (err: any) {
    console.error("[PUT /api/properties/:propertyId/registry-submission/halifax] failed", err);
    return res.status(500).json({
      ok: false,
      error: "registry_submission_save_failed",
      message: err?.message || "Failed to save Halifax registry submission assistant",
    });
  }
});

router.get("/:propertyId/registry-submission/halifax/export", async (req: any, res) => {
  const roleAdmin = isAdminRole(req);
  const landlordId = resolveLandlordId(req);
  const propertyId = String(req.params?.propertyId || "").trim();

  if (!propertyId) return res.status(400).json({ ok: false, error: "property_id_required" });
  if (!roleAdmin && !landlordId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const property = await loadPropertyOr404(propertyId);
    if (!property) return res.status(404).json({ ok: false, error: "not_found" });
    const ownership = ensurePropertyOwnership({ req, property, landlordId, roleAdmin });
    if (!ownership.ok) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }

    const submission = await markHalifaxRegistrySubmissionExported({
      property: { id: propertyId, ...property },
      landlordId: ownership.ownerLandlordId || landlordId,
      actorUserId: String(req.user?.id || "").trim() || null,
      actorEmail: String(req.user?.email || "").trim() || null,
    });
    const exportPayload = buildHalifaxRegistrySubmissionExportPayload({
      property: { id: propertyId, ...property },
      submission,
    });

    return res.json({
      ok: true,
      submission,
      exportPayload,
    });
  } catch (err: any) {
    console.error("[GET /api/properties/:propertyId/registry-submission/halifax/export] failed", err);
    if (String(err?.message || "").toLowerCase().includes("not ready for export")) {
      return res.status(400).json({
        ok: false,
        error: "registry_submission_not_ready",
        message: err?.message || "Halifax submission draft is not ready for export.",
      });
    }
    return res.status(500).json({
      ok: false,
      error: "registry_submission_export_failed",
      message: err?.message || "Failed to export Halifax registry submission data",
    });
  }
});

/**
 * POST /api/properties/:propertyId/publish
 * Publishes a property once at least one unit exists.
 */
router.post("/:propertyId/publish", async (req: any, res) => {
  const roleAdmin = isAdminRole(req);
  const landlordId = resolveLandlordId(req);
  const propertyId = String(req.params?.propertyId || "").trim();

  if (!propertyId) return res.status(400).json({ ok: false, error: "property_id_required" });
  if (!roleAdmin && !landlordId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const propertyRef = db.collection("properties").doc(propertyId);
    const propertySnap = await propertyRef.get();
    if (!propertySnap.exists) return res.status(404).json({ ok: false, error: "not_found" });

    const property = (propertySnap.data() || {}) as any;
    const ownerLandlordId = String(property?.landlordId || "").trim();
    if (!roleAdmin && ownerLandlordId !== landlordId) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }

    const unitsSnap = await db
      .collection("units")
      .where("propertyId", "==", propertyId)
      .where("landlordId", "==", ownerLandlordId || landlordId)
      .limit(1)
      .get();

    if (unitsSnap.empty) {
      return res.status(400).json({
        ok: false,
        error: "units_required",
        detail: "Add at least one unit before publishing.",
      });
    }

    const nowMs = Date.now();
    const updates = {
      status: "PUBLISHED",
      publishedAt: nowMs,
      updatedAt: new Date(nowMs).toISOString(),
      updatedAtServer: FieldValue.serverTimestamp(),
    };

    await propertyRef.set(updates, { merge: true });
    return res.json({ ok: true, property: { id: propertyId, ...property, ...updates } });
  } catch (err: any) {
    console.error("[POST /api/properties/:propertyId/publish] failed", err);
    return res.status(500).json({
      ok: false,
      error: "db_failed",
      message: err?.message || "Failed to publish property",
    });
  }
});

function ensurePropertyOwnership(params: {
  req: any;
  property: any;
  landlordId: string;
  roleAdmin: boolean;
}) {
  const ownerLandlordId = String(params.property?.landlordId || "").trim();
  if (!params.roleAdmin && ownerLandlordId !== params.landlordId) {
    return { ok: false as const, ownerLandlordId };
  }
  return { ok: true as const, ownerLandlordId };
}

router.post("/:propertyId/archive", async (req: any, res) => {
  const roleAdmin = isAdminRole(req);
  const landlordId = resolveLandlordId(req);
  const propertyId = String(req.params?.propertyId || "").trim();

  if (!propertyId) return res.status(400).json({ ok: false, error: "property_id_required" });
  if (!roleAdmin && !landlordId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const propertyRef = db.collection("properties").doc(propertyId);
    const propertySnap = await propertyRef.get();
    if (!propertySnap.exists) return res.status(404).json({ ok: false, error: "not_found" });

    const property = (propertySnap.data() || {}) as any;
    const ownership = ensurePropertyOwnership({ req, property, landlordId, roleAdmin });
    if (!ownership.ok) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }

    const nowIso = new Date().toISOString();
    const updates = {
      portfolioStatus: "archived" as const,
      archivedAt: nowIso,
      archivedByUserId: String(req.user?.id || "").trim() || null,
      updatedAt: nowIso,
      updatedAtServer: FieldValue.serverTimestamp(),
    };

    await propertyRef.set(updates, { merge: true });
    return res.json({ ok: true, property: { id: propertyId, ...property, ...updates } });
  } catch (err: any) {
    console.error("[POST /api/properties/:propertyId/archive] failed", err);
    return res.status(500).json({
      ok: false,
      error: "db_failed",
      message: err?.message || "Failed to archive property",
    });
  }
});

router.post("/:propertyId/unarchive", async (req: any, res) => {
  const roleAdmin = isAdminRole(req);
  const landlordId = resolveLandlordId(req);
  const propertyId = String(req.params?.propertyId || "").trim();

  if (!propertyId) return res.status(400).json({ ok: false, error: "property_id_required" });
  if (!roleAdmin && !landlordId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const propertyRef = db.collection("properties").doc(propertyId);
    const propertySnap = await propertyRef.get();
    if (!propertySnap.exists) return res.status(404).json({ ok: false, error: "not_found" });

    const property = (propertySnap.data() || {}) as any;
    const ownership = ensurePropertyOwnership({ req, property, landlordId, roleAdmin });
    if (!ownership.ok) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }

    const nowIso = new Date().toISOString();
    const updates = {
      portfolioStatus: "active" as const,
      archivedAt: null,
      archivedByUserId: null,
      updatedAt: nowIso,
      updatedAtServer: FieldValue.serverTimestamp(),
    };

    await propertyRef.set(updates, { merge: true });
    return res.json({ ok: true, property: { id: propertyId, ...property, ...updates } });
  } catch (err: any) {
    console.error("[POST /api/properties/:propertyId/unarchive] failed", err);
    return res.status(500).json({
      ok: false,
      error: "db_failed",
      message: err?.message || "Failed to unarchive property",
    });
  }
});

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
