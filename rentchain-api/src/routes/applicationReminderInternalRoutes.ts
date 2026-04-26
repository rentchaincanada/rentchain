import { Router } from "express";
import { processEligibleApplicationLinkReminders } from "../services/applicationReminderService";

const router = Router();

function requireInternalJobToken(req: any, res: any, next: any) {
  const expected = String(process.env.INTERNAL_JOB_TOKEN || "").trim();
  const received = String(req.headers["x-internal-job-token"] || "").trim();
  if (!expected || received !== expected) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }
  return next();
}

router.post("/application-links/process-reminders", requireInternalJobToken, async (req: any, res) => {
  try {
    const limit = req.body?.limit;
    const result = await processEligibleApplicationLinkReminders(limit);
    console.info(
      "[application_reminder_process]",
      JSON.stringify({
        scanned: result.scanned,
        eligible: result.eligible,
        sent: result.sent,
        skipped: result.skipped,
        failed: result.failed,
        processedLinkIds: result.processedLinkIds,
      })
    );
    return res.json({ ok: true, data: result });
  } catch (err: any) {
    console.error("[application_reminder_process] failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "application_reminder_process_failed" });
  }
});

export default router;
