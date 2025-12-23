import crypto from "crypto";
import { Router } from "express";
import { processSubmission } from "../services/reporting/reportingWorker";

const router = Router();

function verifySignature(rawBody: string, provided: string | undefined, secret: string | undefined): boolean {
  if (!provided || !secret) return false;
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(rawBody || "");
  const expected = hmac.digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}

router.post("/process", async (req: any, res) => {
  const secret = process.env.REPORTING_TASK_SECRET;
  const signature = req.header("x-reporting-task-signature");
  const raw = typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});
  if (!verifySignature(raw, signature, secret)) {
    return res.status(401).json({ error: "Invalid task signature" });
  }

  const submissionId = req.body?.submissionId;
  if (!submissionId) return res.status(400).json({ error: "submissionId required" });

  try {
    await processSubmission(submissionId);
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "processing error" });
  }
});

export default router;
