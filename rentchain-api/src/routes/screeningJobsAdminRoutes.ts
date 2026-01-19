import { Router } from "express";
import { db } from "../config/firebase";
import { claimNextJob, enqueueScreeningJob, runJob } from "../services/screeningJobs";

const router = Router();

function requireInternalOrAdmin(req: any, res: any, next: any) {
  const token = String(req.headers["x-internal-token"] || "");
  if (process.env.INTERNAL_JOB_TOKEN && token === process.env.INTERNAL_JOB_TOKEN) {
    return next();
  }
  const role = String(req.user?.role || "").toLowerCase();
  if (role === "admin") return next();
  return res.status(403).json({ ok: false, error: "FORBIDDEN" });
}

router.post("/admin/screening-jobs/run", requireInternalOrAdmin, async (_req, res) => {
  try {
    const maxJobs = 10;
    let processed = 0;
    for (let i = 0; i < maxJobs; i += 1) {
      const claim = await claimNextJob({ maxLockMs: 5 * 60 * 1000 });
      const job = claim.job;
      if (!job) break;
      await runJob(job);
      processed += 1;
    }
    return res.json({ ok: true, processed });
  } catch (err: any) {
    console.error("[screening-jobs] run failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "RUN_FAILED" });
  }
});

router.post("/admin/screening-jobs/enqueue/:orderId", requireInternalOrAdmin, async (req, res) => {
  try {
    const orderId = String(req.params?.orderId || "").trim();
    if (!orderId) return res.status(400).json({ ok: false, error: "missing_order_id" });

    const orderSnap = await db.collection("screeningOrders").doc(orderId).get();
    if (!orderSnap.exists) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    const order = orderSnap.data() as any;
    const applicationId = String(order?.applicationId || "").trim();
    if (!applicationId) {
      return res.status(400).json({ ok: false, error: "missing_application_id" });
    }

    const enqueue = await enqueueScreeningJob({
      orderId,
      applicationId,
      landlordId: order?.landlordId || null,
      provider: "STUB",
    });
    return res.json({ ...enqueue, ok: true });
  } catch (err: any) {
    console.error("[screening-jobs] enqueue failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "ENQUEUE_FAILED" });
  }
});

export default router;
