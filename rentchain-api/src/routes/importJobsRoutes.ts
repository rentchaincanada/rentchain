import { Router } from "express";
import { requireLandlord } from "../middleware/requireLandlord";
import { jsonError } from "../lib/httpResponse";
import { db } from "../config/firebase";
import { getSignedDownloadUrl } from "../lib/gcsSignedUrl";

const router = Router();

function landlordIdFromReq(req: any) {
  return req.user?.landlordId || req.user?.id;
}

function canAccessJob(req: any, job: any) {
  const landlordId = landlordIdFromReq(req);
  if (!landlordId) return false;
  return String(job.landlordId) === String(landlordId);
}

router.get("/", requireLandlord, async (req, res, next) => {
  try {
    const landlordId = landlordIdFromReq(req);
    if (!landlordId) return jsonError(res, 401, "UNAUTHORIZED", "Unauthorized", undefined, req.requestId);

    const propertyId = String(req.query?.propertyId || "").trim();
    const limitRaw = Number(req.query?.limit ?? 25);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 25;

    let q: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = db
      .collection("importJobs")
      .where("landlordId", "==", landlordId);

    if (propertyId) q = q.where("propertyId", "==", propertyId);

    try {
      q = q.orderBy("createdAt", "desc");
    } catch {
      // if index missing, skip orderBy
    }

    q = q.limit(limit);

    const snap = await q.get();
    const items = snap.docs.map((d: any) => ({ id: d.id, ...(d.data() as any) }));

    return res.json({ ok: true, items, requestId: req.requestId });
  } catch (e) {
    return next(e);
  }
});

router.get("/:jobId", requireLandlord, async (req, res, next) => {
  try {
    const landlordId = landlordIdFromReq(req);
    if (!landlordId) return jsonError(res, 401, "UNAUTHORIZED", "Unauthorized", undefined, req.requestId);

    const jobId = String(req.params.jobId || "");
    if (!jobId) return jsonError(res, 400, "BAD_REQUEST", "jobId required", undefined, req.requestId);

    const ref = db.collection("importJobs").doc(jobId);
    const snap = await ref.get();
    if (!snap.exists) return jsonError(res, 404, "NOT_FOUND", "Import job not found", undefined, req.requestId);

    const job = { id: snap.id, ...(snap.data() as any) };
    if (!canAccessJob(req, job)) return jsonError(res, 403, "FORBIDDEN", "Forbidden", undefined, req.requestId);

    const includeUrls = String(req.query?.includeUrls || "false").toLowerCase() === "true";
    let urls: any = undefined;

    if (includeUrls) {
      const expiresMinutes = Number(req.query?.expiresMinutes ?? 15);
      const exp = Number.isFinite(expiresMinutes) ? Math.min(Math.max(expiresMinutes, 1), 60) : 15;

      urls = {};
      if (job.csvObject?.bucket && job.csvObject?.path) {
        urls.csv = await getSignedDownloadUrl({
          bucket: job.csvObject.bucket,
          path: job.csvObject.path,
          expiresMinutes: exp,
        });
      }
      if (job.reportObject?.bucket && job.reportObject?.path) {
        urls.report = await getSignedDownloadUrl({
          bucket: job.reportObject.bucket,
          path: job.reportObject.path,
          expiresMinutes: exp,
        });
      }
    }

    return res.json({ ok: true, job, urls, requestId: req.requestId });
  } catch (e) {
    return next(e);
  }
});

router.post("/:jobId/urls", requireLandlord, async (req, res, next) => {
  try {
    const landlordId = landlordIdFromReq(req);
    if (!landlordId) return jsonError(res, 401, "UNAUTHORIZED", "Unauthorized", undefined, req.requestId);

    const jobId = String(req.params.jobId || "");
    if (!jobId) return jsonError(res, 400, "BAD_REQUEST", "jobId required", undefined, req.requestId);

    const ref = db.collection("importJobs").doc(jobId);
    const snap = await ref.get();
    if (!snap.exists) return jsonError(res, 404, "NOT_FOUND", "Import job not found", undefined, req.requestId);

    const job = { id: snap.id, ...(snap.data() as any) };
    if (!canAccessJob(req, job)) return jsonError(res, 403, "FORBIDDEN", "Forbidden", undefined, req.requestId);

    const expiresMinutes = Number(req.body?.expiresMinutes ?? 15);
    const exp = Number.isFinite(expiresMinutes) ? Math.min(Math.max(expiresMinutes, 1), 60) : 15;

    const urls: any = {};
    if (job.csvObject?.bucket && job.csvObject?.path) {
      urls.csv = await getSignedDownloadUrl({
        bucket: job.csvObject.bucket,
        path: job.csvObject.path,
        expiresMinutes: exp,
      });
    }
    if (job.reportObject?.bucket && job.reportObject?.path) {
      urls.report = await getSignedDownloadUrl({
        bucket: job.reportObject.bucket,
        path: job.reportObject.path,
        expiresMinutes: exp,
      });
    }

    return res.json({ ok: true, urls, requestId: req.requestId });
  } catch (e) {
    return next(e);
  }
});

export default router;
