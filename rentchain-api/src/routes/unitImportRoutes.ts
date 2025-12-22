import { Router } from "express";
import { requireLandlord } from "../middleware/requireLandlord";
import { jsonError } from "../lib/httpResponse";
import { parseUnitsCsv } from "../imports/unitCsvImport.service";
import { fetchExistingUnitNumbersForProperty } from "../imports/unitConflictCheck";
import { commitInBatches } from "../imports/firestoreBatch";
import { assertCanAddUnits } from "../entitlements/checkUnitCap";
import {
  getImportJob,
  startImportJob,
  finishImportJob,
  failImportJob,
} from "../imports/importJobs";
import { db, FieldValue } from "../config/firebase";
import { unitDocId } from "../imports/unitId";

const router = Router({ mergeParams: true });

router.post("/import", requireLandlord, async (req: any, res, next) => {
  const requestId = req.requestId;
  try {
    const { propertyId } = req.params as any;
    const landlordId = (req as any).user?.landlordId || (req as any).user?.id;

    const csvText = String(req.body?.csvText || "");
    const mode = (req.body?.mode || "dryRun") as "dryRun" | "strict" | "partial";
    const idempotencyKey = String(req.body?.idempotencyKey || "").trim();

    if (!propertyId) return jsonError(res, 400, "BAD_REQUEST", "propertyId required", undefined, requestId);
    if (!landlordId) return jsonError(res, 401, "UNAUTHORIZED", "Unauthorized", undefined, requestId);
    if (!csvText.trim()) return jsonError(res, 400, "BAD_REQUEST", "csvText required", undefined, requestId);

    // ensure property belongs to landlord
    const propSnap = await db.collection("properties").doc(propertyId).get();
    if (!propSnap.exists) {
      return jsonError(res, 404, "NOT_FOUND", "Property not found", undefined, requestId);
    }
    const propData = propSnap.data() as any;
    if (propData?.landlordId && propData.landlordId !== landlordId) {
      return jsonError(res, 403, "FORBIDDEN", "Forbidden", undefined, requestId);
    }

    const isWrite = mode === "strict" || mode === "partial";
    let jobRef: any = null;
    if (isWrite) {
      if (!idempotencyKey) {
        return jsonError(res, 400, "BAD_REQUEST", "idempotencyKey required for write modes", undefined, requestId);
      }
      const { ref, snap } = await getImportJob(landlordId, propertyId, idempotencyKey);
      jobRef = ref;
      if (snap.exists) {
        const job = snap.data() as any;
        if (job.status === "completed") {
          return res.status(200).json({ ok: true, idempotentReplay: true, job, requestId });
        }
        if (job.status === "started") {
          return res.status(409).json({
            ok: false,
            code: "CONFLICT",
            error: "Import already in progress for this idempotencyKey",
            requestId,
          });
        }
      }
      await startImportJob(jobRef, {
        landlordId,
        propertyId,
        idempotencyKey,
        mode,
        totalRows: 0,
        attemptedValid: 0,
        createdCount: 0,
        skippedCount: 0,
        errorCount: 0,
      });
    }

    const parsed = parseUnitsCsv(csvText);

    const existing = await fetchExistingUnitNumbersForProperty(propertyId);

    const conflicts: any[] = [];
    const insertable: typeof parsed.candidates = [];
    for (const c of parsed.candidates) {
      if (existing.has(c.unitNumber)) {
        conflicts.push({
          row: c.row,
          code: "ALREADY_EXISTS",
          message: "Unit already exists",
          unitNumber: c.unitNumber,
        });
      } else {
        insertable.push(c);
      }
    }

    const issues = [...parsed.invalid, ...parsed.duplicatesInCsv, ...conflicts];

    if (mode === "dryRun") {
      return res.status(200).json({
        ok: true,
        mode,
        requestId,
        summary: {
          totalRows: parsed.totalRows,
          candidates: parsed.candidates.length,
          insertable: insertable.length,
          invalid: parsed.invalid.length,
          duplicatesInCsv: parsed.duplicatesInCsv.length,
          conflicts: conflicts.length,
        },
        issues: issues.slice(0, 200),
        preview: insertable.slice(0, 25).map((x) => x.data),
      });
    }

    if (mode === "strict" && issues.length > 0) {
      if (jobRef) {
        await failImportJob(jobRef, {
          totalRows: parsed.totalRows,
          attemptedValid: parsed.candidates.length,
          errorCount: issues.length,
        });
      }
      return res.status(400).json({
        ok: false,
        code: "CSV_INVALID",
        error: "CSV contains errors; strict mode aborted",
        requestId,
        summary: {
          totalRows: parsed.totalRows,
          candidates: parsed.candidates.length,
          insertable: insertable.length,
          issueCount: issues.length,
        },
        issues: issues.slice(0, 200),
      });
    }

    const wouldInsert = insertable.length;

    const cap = await assertCanAddUnits(req as any, landlordId, wouldInsert);
    if (!cap.ok) {
      if (jobRef) {
        await failImportJob(jobRef, {
          totalRows: parsed.totalRows,
          attemptedValid: parsed.candidates.length,
          errorCount: issues.length,
        });
      }
      return res.status(409).json({
        ok: false,
        code: "LIMIT_REACHED",
        error: "Plan limit reached: max units",
        requestId,
        details: { plan: cap.plan, current: cap.current, adding: cap.adding, limit: cap.limit },
      });
    }

    const ops: any[] = [];
    for (const c of insertable) {
      const ref = db.collection("units").doc(unitDocId(propertyId, c.unitNumber));
      ops.push((batch: any) => {
        batch.set(ref, {
          landlordId,
          propertyId,
          unitNumber: c.unitNumber,
          rent: c.data.rent ?? null,
          bedrooms: c.data.bedrooms ?? null,
          bathrooms: c.data.bathrooms ?? null,
          sqft: c.data.sqft ?? null,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      });
    }

    await commitInBatches(ops, 400);

    await db
      .collection("landlordUsage")
      .doc(landlordId)
      .set(
        { units: FieldValue.increment(wouldInsert), updatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );

    await db
      .collection("properties")
      .doc(propertyId)
      .set(
        { unitCount: FieldValue.increment(wouldInsert), updatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );

    const skippedCount =
      parsed.invalid.length + parsed.duplicatesInCsv.length + conflicts.length + (parsed.candidates.length - insertable.length);

    if (jobRef) {
      await finishImportJob(jobRef, {
        totalRows: parsed.totalRows,
        attemptedValid: parsed.candidates.length,
        createdCount: wouldInsert,
        skippedCount,
        errorCount: issues.length,
      });
    }

    return res.status(200).json({
      ok: true,
      mode,
      requestId,
      imported: wouldInsert,
      summary: {
        totalRows: parsed.totalRows,
        candidates: parsed.candidates.length,
        insertable: insertable.length,
        invalid: parsed.invalid.length,
        duplicatesInCsv: parsed.duplicatesInCsv.length,
        conflicts: conflicts.length,
      },
      issues: issues.slice(0, 200),
    });
  } catch (e) {
    try {
      // best-effort failure tracking if a job was started
    } catch {}
    return next(e);
  }
});

export default router;
