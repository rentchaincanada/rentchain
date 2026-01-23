// rentchain-api/src/routes/propertiesRoutes.ts
import { Router } from "express";
import { requireCapability } from "../entitlements/entitlements.middleware";
import { enforcePropertyCap, enforceUnitCap } from "../entitlements/limits.middleware";
import { db, FieldValue } from "../config/firebase";

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
  return [street, city, province, postal].filter(Boolean).join("|");
}

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
    const requestId =
      String(req.headers["x-request-id"] || req.headers["x-requestid"] || req.headers["x-correlation-id"] || "")
        .trim() || `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const landlordId = req.user?.landlordId || req.user?.id;
    if (!landlordId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const plan = req.user?.plan || "starter";
    if (process.env.NODE_ENV !== "production") {
      console.log("[POST /api/properties] requestId=", requestId);
      console.log("[POST /api/properties] landlordId=", landlordId);
      console.log("[POST /api/properties] plan=", plan);
    }

    // Starter allows unlimited properties; cap enforcement is handled elsewhere if reintroduced.

    const {
      address,
      nickname,
      name,
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
    const resolvedProvince = firstString(province, addressObj?.province, addressObj?.state);
    const resolvedPostalCode = firstString(postalCode, addressObj?.postalCode, addressObj?.zip);
    const resolvedCountry = firstString(country, addressObj?.country) || "Canada";
    const createdAt = new Date().toISOString();
    const addressKey = makeAddressKeyFromParts(
      resolvedAddressLine1,
      resolvedCity,
      resolvedProvince,
      resolvedPostalCode
    );
    if (!resolvedAddressLine1) {
      return res.status(400).json({
        error: "missing_address",
        message: "addressLine1 is required to create a property.",
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
      unitCount: resolvedUnitCount,
      unitsCount: resolvedUnitCount,
      totalUnits: resolvedUnitCount,
      createdAt,
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

      const property = { id: propertyRef.id, propertyId: propertyRef.id, ...propertyBase };
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
