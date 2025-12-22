import { Router } from "express";
import { requireLandlord } from "../middleware/requireLandlord";
import { parseAndValidateUnitsCsv } from "../imports/unitCsvImport.service";
import { jsonError } from "../lib/httpResponse";
import { db, FieldValue } from "../config/firebase";
import { getUsage } from "../entitlements/usageDoc";
import { PLANS } from "../entitlements/plans";

const router = Router({ mergeParams: true });

router.post("/import", requireLandlord, async (req: any, res, next) => {
  try {
    const { propertyId } = req.params as any;
    const csvText = String(req.body?.csvText || "");
    const dryRun = Boolean(req.body?.dryRun);
    const landlordId = req.user?.landlordId || req.user?.id;
    const plan = (req.user?.plan as keyof typeof PLANS) || "starter";

    if (!propertyId) {
      return jsonError(res, 400, "BAD_REQUEST", "propertyId required", undefined, req.requestId);
    }

    if (!csvText.trim()) {
      return jsonError(res, 400, "BAD_REQUEST", "csvText required", undefined, req.requestId);
    }

    const parsed = parseAndValidateUnitsCsv(csvText);

    if (parsed.errors.length) {
      return res.status(400).json({
        ok: false,
        code: "CSV_INVALID",
        requestId: req.requestId,
        summary: {
          totalRows: parsed.totalRows,
          validCount: parsed.validCount,
          invalidCount: parsed.invalidCount,
        },
        errors: parsed.errors.slice(0, 200),
      });
    }

    // plan cap enforcement using usage doc
    const usage = await getUsage(landlordId);
    const limit = PLANS[plan]?.limits?.maxUnits ?? PLANS.starter.limits.maxUnits;
    const batchCount = parsed.items.length;
    if (usage.units + batchCount > limit) {
      return jsonError(
        res,
        409,
        "LIMIT_REACHED",
        "Plan limit reached: max units",
        { plan, current: usage.units, adding: batchCount, limit },
        req.requestId
      );
    }

    // Basic duplicate check against existing units for this property (batched IN queries of 10)
    const unitNumbers = parsed.items.map((i) => i.unitNumber);
    const existingConflicts: Set<string> = new Set();
    for (let i = 0; i < unitNumbers.length; i += 10) {
      const slice = unitNumbers.slice(i, i + 10);
      const snap = await db
        .collection("units")
        .where("propertyId", "==", propertyId)
        .where("unitNumber", "in", slice)
        .get();
      snap.forEach((doc) => {
        const data = doc.data() as any;
        if (data?.unitNumber) existingConflicts.add(String(data.unitNumber));
      });
    }

    if (existingConflicts.size > 0) {
      return res.status(409).json({
        ok: false,
        code: "CONFLICT",
        error: "Some units already exist for this property",
        conflicts: Array.from(existingConflicts).slice(0, 50),
        requestId: req.requestId,
      });
    }

    if (dryRun) {
      return res.json({
        ok: true,
        dryRun: true,
        summary: {
          totalRows: parsed.totalRows,
          validCount: parsed.validCount,
        },
        preview: parsed.items.slice(0, 25),
      });
    }

    await db.runTransaction(async (tx) => {
      const usageRef = db.collection("landlordUsage").doc(landlordId);
      tx.set(
        usageRef,
        {
          units: FieldValue.increment(batchCount),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      for (const it of parsed.items) {
        const ref = db.collection("units").doc();
        tx.set(ref, {
          landlordId,
          propertyId,
          unitNumber: it.unitNumber,
          rent: it.rent ?? null,
          bedrooms: it.bedrooms ?? null,
          bathrooms: it.bathrooms ?? null,
          sqft: it.sqft ?? null,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    });

    return res.json({
      ok: true,
      imported: batchCount,
    });
  } catch (e) {
    return next(e);
  }
});

export default router;
