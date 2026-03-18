import { Router } from "express";
import { uploadBufferToGcs } from "../lib/gcs";
import { sendEmail } from "../services/emailService";
import { runStatusHealthSync } from "../services/statusHealthSync";
import { recomputeLeaseRisk } from "../services/risk/recomputeLeaseRisk";
import { recomputeTenantScore } from "../services/risk/recomputeTenantScore";
import {
  getTuReferralMetricsForMonth,
  renderTuReferralCsv,
  renderTuReferralEmail,
  renderTuReferralJson,
  renderTuReferralReportText,
} from "../services/metrics/tuReferralReport";

const router = Router();

function requireInternalJobToken(req: any, res: any, next: any) {
  const expected = String(process.env.INTERNAL_JOB_TOKEN || "").trim();
  const received = String(req.headers["x-internal-job-token"] || "").trim();
  if (!expected || received !== expected) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }
  return next();
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function parseRecipients(value: string) {
  return String(value || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

router.post("/reports/tu-referrals", requireInternalJobToken, async (req: any, res) => {
  const startedAt = Date.now();
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const cadence = String(body?.cadence || "manual").trim().toLowerCase() || "manual";
  const month = String(body?.month || "").trim() || currentMonthKey();

  try {
    const metrics = await getTuReferralMetricsForMonth(month);
    const textSummary = renderTuReferralReportText(metrics);
    const csvText = renderTuReferralCsv(metrics);
    const jsonText = renderTuReferralJson(metrics);

    let artifactPaths: { csv?: string; json?: string } | undefined;
    const bucket = String(process.env.GCS_UPLOAD_BUCKET || "").trim();
    if (bucket) {
      const ts = Date.now();
      const basePath = `reports/tu-referrals/${metrics.month}`;
      const csvPath = `${basePath}/${ts}.csv`;
      const jsonPath = `${basePath}/${ts}.json`;
      const [csvSaved, jsonSaved] = await Promise.all([
        uploadBufferToGcs({
          path: csvPath,
          contentType: "text/csv; charset=utf-8",
          buffer: Buffer.from(csvText, "utf8"),
          metadata: { report: "tu-referrals", month: metrics.month, cadence },
        }),
        uploadBufferToGcs({
          path: jsonPath,
          contentType: "application/json; charset=utf-8",
          buffer: Buffer.from(jsonText, "utf8"),
          metadata: { report: "tu-referrals", month: metrics.month, cadence },
        }),
      ]);
      artifactPaths = {
        csv: `gs://${csvSaved.bucket}/${csvSaved.path}`,
        json: `gs://${jsonSaved.bucket}/${jsonSaved.path}`,
      };
    }

    const recipients = parseRecipients(String(process.env.TU_REPORT_RECIPIENTS || ""));
    if (recipients.length > 0) {
      const sender =
        String(process.env.TU_REPORT_SENDER || "").trim() ||
        String(process.env.EMAIL_FROM || process.env.FROM_EMAIL || "").trim() ||
        undefined;
      const email = renderTuReferralEmail(metrics, {
        csv: artifactPaths?.csv || null,
        json: artifactPaths?.json || null,
      });
      await sendEmail({
        to: recipients,
        from: sender,
        subject: email.subject,
        text: email.body || textSummary,
      });
    }

    console.info(
      "[tu_metrics_report]",
      JSON.stringify({
        report: "tu_referrals",
        month: metrics.month,
        cadence,
        success: true,
        durationMs: Date.now() - startedAt,
        recipientsCount: recipients.length,
        artifactPaths: artifactPaths || null,
      })
    );

    return res.json({
      ok: true,
      month: metrics.month,
      artifactPaths: artifactPaths || null,
      emailedTo: recipients,
    });
  } catch (err: any) {
    console.error("[tu_metrics_report] failed", {
      month,
      cadence,
      error: err?.message || String(err),
      durationMs: Date.now() - startedAt,
    });
    return res.status(500).json({ ok: false, error: "report_generation_failed" });
  }
});

router.post("/leases/:leaseId/recompute-risk", requireInternalJobToken, async (req: any, res) => {
  try {
    const leaseId = String(req.params?.leaseId || "").trim();
    if (!leaseId) {
      return res.status(400).json({ ok: false, error: "lease_id_required" });
    }

    const result = await recomputeLeaseRisk(leaseId);
    return res.json({ ok: true, ...result });
  } catch (err: any) {
    console.error("[internal lease risk recompute] failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "lease_risk_recompute_failed" });
  }
});

router.post("/tenants/:tenantId/recompute-score", requireInternalJobToken, async (req: any, res) => {
  try {
    const tenantId = String(req.params?.tenantId || "").trim();
    if (!tenantId) {
      return res.status(400).json({ ok: false, error: "tenant_id_required" });
    }

    const result = await recomputeTenantScore(tenantId);
    return res.json({ ok: true, ...result });
  } catch (err: any) {
    console.error("[internal tenant score recompute] failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "tenant_score_recompute_failed" });
  }
});

router.post("/status/health-sync", requireInternalJobToken, async (_req: any, res) => {
  try {
    const result = await runStatusHealthSync();
    return res.json(result);
  } catch (err: any) {
    console.error("[status_health_sync] failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "status_health_sync_failed" });
  }
});

export default router;
