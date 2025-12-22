import { Router } from "express";
import { requireLandlord } from "../middleware/requireLandlord";
import { rateLimit } from "../middleware/rateLimit";
import { jsonError } from "../lib/httpResponse";
import { db } from "../config/firebase";
import { handleArtifactDownload } from "./importDownload.controller";
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

const csvStack = [requireLandlord, rateLimit({ windowMs: 60_000, max: 20 })];

router.head("/:jobId/download/csv", ...csvStack, async (req, res) => {
  const requestId = req.requestId;
  const job = await loadJob(req);
  if (!job) return jsonError(res, 404, "NOT_FOUND", "Import job not found", undefined, requestId);
  if (!assertOwnership(req, job)) return jsonError(res, 403, "FORBIDDEN", "Forbidden", undefined, requestId);

  const obj = job.csvObject;
  if (!obj?.bucket || !obj?.path) {
    return jsonError(res, 404, "NOT_FOUND", "CSV artifact not found for this job", undefined, requestId);
  }

  return handleArtifactDownload({
    req,
    res,
    kind: "csv",
    obj: {
      bucket: obj.bucket,
      path: obj.path,
      contentType: obj.contentType || "text/csv",
      filename: obj.originalName || "import.csv",
    },
  });
});

router.get("/:jobId/download/csv", ...csvStack, async (req, res) => {
  const requestId = req.requestId;
  const job = await loadJob(req);
  if (!job) return jsonError(res, 404, "NOT_FOUND", "Import job not found", undefined, requestId);
  if (!assertOwnership(req, job)) return jsonError(res, 403, "FORBIDDEN", "Forbidden", undefined, requestId);

  const obj = job.csvObject;
  if (!obj?.bucket || !obj?.path) {
    return jsonError(res, 404, "NOT_FOUND", "CSV artifact not found for this job", undefined, requestId);
  }

  return handleArtifactDownload({
    req,
    res,
    kind: "csv",
    obj: {
      bucket: obj.bucket,
      path: obj.path,
      contentType: obj.contentType || "text/csv",
      filename: obj.originalName || "import.csv",
    },
  });
});

const reportStack = [requireLandlord, rateLimit({ windowMs: 60_000, max: 60 })];

router.head("/:jobId/download/report", ...reportStack, async (req, res) => {
  const requestId = req.requestId;
  const job = await loadJob(req);
  if (!job) return jsonError(res, 404, "NOT_FOUND", "Import job not found", undefined, requestId);
  if (!assertOwnership(req, job)) return jsonError(res, 403, "FORBIDDEN", "Forbidden", undefined, requestId);

  const obj = job.reportObject;
  if (!obj?.bucket || !obj?.path) {
    return jsonError(res, 404, "NOT_FOUND", "Report artifact not found for this job", undefined, requestId);
  }

  return handleArtifactDownload({
    req,
    res,
    kind: "report",
    obj: {
      bucket: obj.bucket,
      path: obj.path,
      contentType: obj.contentType || "application/json",
      filename: `import-report-${job.id}.json`,
    },
    gzipObj: job.reportGzipObject
      ? {
          bucket: job.reportGzipObject.bucket,
          path: job.reportGzipObject.path,
          contentType: job.reportGzipObject.contentType || "application/json",
          filename: `import-report-${job.id}.json`,
        }
      : undefined,
    integrity: { sha256: job.reportSha256 },
  });
});

router.get("/:jobId/download/report", ...reportStack, async (req, res) => {
  const requestId = req.requestId;
  const job = await loadJob(req);
  if (!job) return jsonError(res, 404, "NOT_FOUND", "Import job not found", undefined, requestId);
  if (!assertOwnership(req, job)) return jsonError(res, 403, "FORBIDDEN", "Forbidden", undefined, requestId);

  const obj = job.reportObject;
  if (!obj?.bucket || !obj?.path) {
    return jsonError(res, 404, "NOT_FOUND", "Report artifact not found for this job", undefined, requestId);
  }

  return handleArtifactDownload({
    req,
    res,
    kind: "report",
    obj: {
      bucket: obj.bucket,
      path: obj.path,
      contentType: obj.contentType || "application/json",
      filename: `import-report-${job.id}.json`,
    },
  });
});

export default router;
