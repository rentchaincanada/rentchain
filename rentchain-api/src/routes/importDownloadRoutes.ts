import { Router } from "express";
import { requireLandlord } from "../middleware/requireLandlord";
import { rateLimit } from "../middleware/rateLimit";
import { jsonError } from "../lib/httpResponse";
import { db } from "../config/firebase";
import { getFileReadStream } from "../lib/gcsRead";
// import { redactCsvColumns } from "../imports/csvRedact";

const router = Router();

function landlordIdFromReq(req: any) {
  return req.user?.landlordId || req.user?.id;
}

async function loadJob(req: any) {
  const jobId = String(req.params.jobId || "");
  const ref = db.collection("importJobs").doc(jobId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  return { id: snap.id, ...(snap.data() as any) };
}

function assertOwnership(req: any, job: any) {
  const landlordId = landlordIdFromReq(req);
  return landlordId && String(job.landlordId) === String(landlordId);
}

router.get(
  "/:jobId/download/csv",
  requireLandlord,
  rateLimit({ windowMs: 60_000, max: 20 }),
  async (req, res) => {
    const requestId = req.requestId;
    const job = await loadJob(req);
    if (!job) return jsonError(res, 404, "NOT_FOUND", "Import job not found", undefined, requestId);
    if (!assertOwnership(req, job)) return jsonError(res, 403, "FORBIDDEN", "Forbidden", undefined, requestId);

    const obj = job.csvObject;
    if (!obj?.bucket || !obj?.path) {
      return jsonError(res, 404, "NOT_FOUND", "CSV artifact not found for this job", undefined, requestId);
    }

    const contentType = obj.contentType || "text/csv";
    const filename = obj.originalName || "import.csv";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${filename.replace(/"/g, "")}"`);
    res.setHeader("x-request-id", requestId || "");

    const stream = getFileReadStream({ bucket: obj.bucket, path: obj.path });

    stream.on("error", (e: any) => {
      console.error("[download/csv] stream error", { requestId, e: e?.message });
      if (!res.headersSent) {
        return jsonError(res, 500, "INTERNAL", "Download failed", undefined, requestId);
      }
      try {
        res.end();
      } catch {
        /* ignore */
      }
    });

    // const redactCols = String(process.env.CSV_REDACT_COLUMNS || "")
    //   .split(",")
    //   .map((s) => s.trim())
    //   .filter(Boolean);
    // if (redactCols.length) return stream.pipe(redactCsvColumns(redactCols)).pipe(res);

    return stream.pipe(res);
  }
);

router.get(
  "/:jobId/download/report",
  requireLandlord,
  rateLimit({ windowMs: 60_000, max: 60 }),
  async (req, res) => {
    const requestId = req.requestId;
    const job = await loadJob(req);
    if (!job) return jsonError(res, 404, "NOT_FOUND", "Import job not found", undefined, requestId);
    if (!assertOwnership(req, job)) return jsonError(res, 403, "FORBIDDEN", "Forbidden", undefined, requestId);

    const obj = job.reportObject;
    if (!obj?.bucket || !obj?.path) {
      return jsonError(res, 404, "NOT_FOUND", "Report artifact not found for this job", undefined, requestId);
    }

    res.setHeader("Content-Type", obj.contentType || "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="import-report-${job.id}.json"`);
    res.setHeader("x-request-id", requestId || "");

    const stream = getFileReadStream({ bucket: obj.bucket, path: obj.path });

    stream.on("error", (e: any) => {
      console.error("[download/report] stream error", { requestId, e: e?.message });
      if (!res.headersSent) {
        return jsonError(res, 500, "INTERNAL", "Download failed", undefined, requestId);
      }
      try {
        res.end();
      } catch {
        /* ignore */
      }
    });

    return stream.pipe(res);
  }
);

export default router;
