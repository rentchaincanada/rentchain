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
import { uploadCsv } from "../middleware/uploadCsv";
import { uploadBufferToGcs } from "../lib/gcs";

const router = Router({ mergeParams: true });

type RunImportResult = {
  httpStatus: number;
  body: any;
  report: any;
  idempotentReplay?: boolean;
};

async function runUnitImport(opts: {
  landlordId: string;
  propertyId: string;
  mode: "dryRun" | "strict" | "partial";
  idempotencyKey?: string;
  csvText: string;
  requestId?: string;
  jobRef?: FirebaseFirestore.DocumentReference | null;
  jobAlreadyStarted?: boolean;
  plan?: string;
  user?: any;
}): Promise<RunImportResult> {
  const { landlordId, propertyId, mode, idempotencyKey, csvText, requestId } = opts;
  const isWrite = mode === "strict" || mode === "partial";

  let jobRef = opts.jobRef ?? null;

  if (isWrite && !opts.jobAlreadyStarted) {
    if (!idempotencyKey) {
      return {
        httpStatus: 400,
        body: { ok: false, code: "BAD_REQUEST", error: "idempotencyKey required for write modes", requestId },
        report: { ok: false, reason: "missing idempotencyKey" },
      };
    }
    const { ref, snap } = await getImportJob(landlordId, propertyId, idempotencyKey);
    jobRef = ref;
    if (snap.exists) {
      const job = snap.data() as any;
      if (job.status === "completed") {
        return {
          httpStatus: 200,
          body: { ok: true, idempotentReplay: true, job, requestId },
          report: { ok: true, idempotentReplay: true, job },
          idempotentReplay: true,
        };
      }
      if (job.status === "started") {
        return {
          httpStatus: 409,
          body: { ok: false, code: "CONFLICT", error: "Import already in progress for this idempotencyKey", requestId },
          report: { ok: false, reason: "in_progress" },
        };
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

  const summary = {
    totalRows: parsed.totalRows,
    candidates: parsed.candidates.length,
    insertable: insertable.length,
    invalid: parsed.invalid.length,
    duplicatesInCsv: parsed.duplicatesInCsv.length,
    conflicts: conflicts.length,
  };

  if (mode === "dryRun") {
    return {
      httpStatus: 200,
      body: {
        ok: true,
        mode,
        requestId,
        summary,
        issues: issues.slice(0, 200),
        preview: insertable.slice(0, 25).map((x) => x.data),
      },
      report: { mode, summary, issues },
    };
  }

  if (mode === "strict" && issues.length > 0) {
    if (jobRef) {
      await failImportJob(jobRef, {
        totalRows: parsed.totalRows,
        attemptedValid: parsed.candidates.length,
        errorCount: issues.length,
      });
    }
    return {
      httpStatus: 400,
      body: {
        ok: false,
        code: "CSV_INVALID",
        error: "CSV contains errors; strict mode aborted",
        requestId,
        summary: { ...summary, issueCount: issues.length },
        issues: issues.slice(0, 200),
      },
      report: { ok: false, mode, summary, issues },
    };
  }

  const wouldInsert = insertable.length;
  const cap = await assertCanAddUnits(
    { plan: opts.plan, user: opts.user } as any,
    landlordId,
    wouldInsert
  );
  if (!cap.ok) {
    if (jobRef) {
      await failImportJob(jobRef, {
        totalRows: parsed.totalRows,
        attemptedValid: parsed.candidates.length,
        errorCount: issues.length,
      });
    }
    return {
      httpStatus: 409,
      body: {
        ok: false,
        code: "LIMIT_REACHED",
        error: "Plan limit reached: max units",
        requestId,
        details: { plan: cap.plan, current: cap.current, adding: cap.adding, limit: cap.limit },
      },
      report: { ok: false, mode, summary, issues, limit: cap },
    };
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
    parsed.invalid.length +
    parsed.duplicatesInCsv.length +
    conflicts.length +
    (parsed.candidates.length - insertable.length);

  if (jobRef) {
    await finishImportJob(jobRef, {
      totalRows: parsed.totalRows,
      attemptedValid: parsed.candidates.length,
      createdCount: wouldInsert,
      skippedCount,
      errorCount: issues.length,
    });
  }

  const body = {
    ok: true,
    mode,
    requestId,
    imported: wouldInsert,
    summary,
    issues: issues.slice(0, 200),
  };

  const report = { ok: true, mode, summary, issues, imported: wouldInsert };

  return { httpStatus: 200, body, report };
}

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

    const propSnap = await db.collection("properties").doc(propertyId).get();
    if (!propSnap.exists) {
      return jsonError(res, 404, "NOT_FOUND", "Property not found", undefined, requestId);
    }
    const propData = propSnap.data() as any;
    if (propData?.landlordId && propData.landlordId !== landlordId) {
      return jsonError(res, 403, "FORBIDDEN", "Forbidden", undefined, requestId);
    }

    const result = await runUnitImport({
      landlordId,
      propertyId,
      mode,
      idempotencyKey,
      csvText,
      requestId,
      plan: req.user?.plan,
      user: req.user,
    });

    return res.status(result.httpStatus).json(result.body);
  } catch (e) {
    return next(e);
  }
});

router.post(
  "/import-upload",
  requireLandlord,
  uploadCsv.single("file"),
  async (req: any, res, next) => {
    const requestId = req.requestId;
    try {
      const { propertyId } = req.params as any;
      const landlordId = (req as any).user?.landlordId || (req as any).user?.id;

      const mode = (req.body?.mode || "dryRun") as "dryRun" | "strict" | "partial";
      const idempotencyKey = String(req.body?.idempotencyKey || "").trim();
      const file = req.file as Express.Multer.File | undefined;

      if (!propertyId) return jsonError(res, 400, "BAD_REQUEST", "propertyId required", undefined, requestId);
      if (!landlordId) return jsonError(res, 401, "UNAUTHORIZED", "Unauthorized", undefined, requestId);
      if (!file?.buffer) {
        return jsonError(res, 400, "BAD_REQUEST", "CSV file required (field name: file)", undefined, requestId);
      }

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
          csvObject: {
            bucket: process.env.GCS_UPLOAD_BUCKET,
            path: "",
            contentType: file.mimetype || "text/csv",
            originalName: file.originalname || "upload.csv",
            bytes: file.size || file.buffer.length,
          },
        });
      }

      const csvText = file.buffer.toString("utf8");

      const now = new Date().toISOString().replace(/[:.]/g, "-");
      const keyPart = idempotencyKey ? idempotencyKey : `rid-${requestId || "na"}`;
      const csvPath = `imports/${landlordId}/${propertyId}/${now}__${keyPart}__units.csv`;

      const csvObj = await uploadBufferToGcs({
        path: csvPath,
        contentType: file.mimetype || "text/csv",
        buffer: file.buffer,
        metadata: {
          landlordId,
          propertyId,
          mode,
          idempotencyKey: idempotencyKey || "",
          requestId: requestId || "",
          originalName: file.originalname || "",
        },
      });

      if (jobRef) {
        await jobRef.set(
          {
            csvObject: {
              ...csvObj,
              contentType: file.mimetype || "text/csv",
              originalName: file.originalname || "upload.csv",
              bytes: file.size || file.buffer.length,
            },
          },
          { merge: true }
        );
      }

      const result = await runUnitImport({
        landlordId,
        propertyId,
        mode,
        idempotencyKey,
        csvText,
        requestId,
        jobRef,
        jobAlreadyStarted: !!jobRef,
        plan: req.user?.plan,
        user: req.user,
      });

      if (result.idempotentReplay) {
        return res.status(result.httpStatus).json(result.body);
      }

      const reportJson = Buffer.from(JSON.stringify(result.report, null, 2), "utf8");
      const reportPath = `imports/${landlordId}/${propertyId}/${now}__${keyPart}__report.json`;

      const reportObj = await uploadBufferToGcs({
        path: reportPath,
        contentType: "application/json",
        buffer: reportJson,
        metadata: {
          landlordId,
          propertyId,
          mode,
          idempotencyKey: idempotencyKey || "",
          requestId: requestId || "",
        },
      });

      if (jobRef) {
        await jobRef.set({ reportObject: { ...reportObj, contentType: "application/json" } }, { merge: true });
      }

      return res.status(result.httpStatus).json({
        ...result.body,
        requestId,
        storage: { csv: csvObj, report: reportObj },
      });
    } catch (e) {
      return next(e);
    }
  }
);

export default router;
