import { Router } from "express";
import {
  getReportingRuntimeConfig,
  setReportingPaused,
  getPilotLandlordAllowlist,
} from "../services/reporting/reportingConfig";
import { db } from "../config/firebase";
import { getProvider } from "../services/creditReporting/providerFactory";
import { toMetro2LikeRecords } from "../services/creditReporting/metro2Model";
import { getTenantCreditHistory } from "../services/tenantCreditProfileService";
import { enqueueSubmission } from "../services/reporting/reportingQueue";
import { getTenantCreditHistory as getHistory } from "../services/tenantCreditProfileService";
import { sweepStuckSubmissions } from "../services/reporting/reportingSweeper";
import { getStuckThresholdMinutes, getSweepLimit } from "../services/reporting/reportingConfig";
import { createLedgerEvent } from "../services/ledgerEventsService";
import { hashPayload } from "../events/factory";
import { v4 as uuid } from "uuid";

const router = Router();

// Dev-only cron-like runner
router.post("/reporting/run-once", async (_req, res) => {
  const cfg = await getReportingRuntimeConfig();
  if (!cfg.enabled) return res.status(503).json({ error: "Reporting paused", paused: true });
  if (!cfg.dryRun) return res.status(409).json({ error: "Live reporting disabled in Phase 3.2A. Enable dryRun in config." });
  try {
    // Sweep stuck items first
    const sweepSummary = await sweepStuckSubmissions({
      olderThanMinutes: getStuckThresholdMinutes(),
      limit: getSweepLimit(),
      dryRun: false,
    });

    const snap = await db
      .collection("reportingSubmissions")
      .where("status", "==", "queued")
      .limit(5)
      .get();

    const updates: any[] = [];
    for (const doc of snap.docs) {
      await enqueueSubmission(doc.id);
      updates.push({ id: doc.id, status: "queued->processing" });
    }

    return res.json({ processed: updates.length, sweep: sweepSummary, updates });
  } catch (err) {
    console.error("[adminReportingRoutes] run-once error", err);
    return res.status(500).json({ error: "Failed to process reporting queue" });
  }
});

router.get("/reporting/providers", async (_req, res) => {
  const providers = ["mock", "singlekey", "frontlobby"];
  const out = providers.map((key) => {
    try {
      const p = getProvider(key);
      p.validateConfig();
      return { providerKey: key, enabled: true, configStatus: "ok", lastHealthCheckAt: new Date().toISOString() };
    } catch (err: any) {
      return {
        providerKey: key,
        enabled: true,
        configStatus: err?.message?.toLowerCase().includes("not implemented") ? "invalid" : "missing_secrets",
        lastHealthCheckAt: null,
      };
    }
  });
  return res.json(out);
});

router.get("/reporting/metrics", async (req, res) => {
  const days = Number(req.query.days || 7);
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  const snap = await db
    .collection("reportingSubmissions")
    .where("createdAt", ">=", new Date(since).toISOString())
    .get();
  const byStatus: Record<string, number> = {};
  const byProvider: Record<string, number> = {};
  let processedCount = 0;
  snap.forEach((doc) => {
    const d = doc.data() as any;
    byStatus[d.status] = (byStatus[d.status] || 0) + 1;
    byProvider[d.providerKey || "unknown"] = (byProvider[d.providerKey || "unknown"] || 0) + 1;
    if (["accepted", "rejected", "failed_retryable", "failed_final"].includes(d.status)) processedCount += 1;
  });
  return res.json({
    windowDays: days,
    counts: byStatus,
    byProvider,
    processedCount,
    total: snap.size,
  });
});

router.post("/reporting/retry", async (req, res) => {
  const submissionId = req.body?.submissionId;
  if (!submissionId) return res.status(400).json({ error: "submissionId required" });
  const cfg = await getReportingRuntimeConfig();
  const ref = db.collection("reportingSubmissions").doc(submissionId);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: "not found" });
  const data = snap.data() as any;
  if (!["failed_retryable", "rejected", "failed_final"].includes(data.status)) {
    return res.status(409).json({ error: "Not retryable" });
  }
  if ((data.attempts || 0) >= cfg.maxAttempts) {
    return res.status(409).json({ error: "Max attempts reached" });
  }
  await ref.update({ status: "queued", lastError: null });
  await enqueueSubmission(submissionId);
  return res.json({ ok: true });
});

router.post("/reporting/pause", async (_req, res) => {
  try {
    const cfg = await setReportingPaused(true);
    return res.json({ ok: true, reportingPaused: true, updatedAt: cfg.updatedAt, note: "Env REPORTING_ENABLED=false still overrides resume." });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Failed to pause reporting" });
  }
});

router.post("/reporting/resume", async (_req, res) => {
  try {
    const cfg = await setReportingPaused(false);
    return res.json({ ok: true, reportingPaused: false, updatedAt: cfg.updatedAt, note: "Env REPORTING_ENABLED=false will still keep reporting off." });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Failed to resume reporting" });
  }
});

router.post("/reporting/sweep-stuck", async (req, res) => {
  try {
    const result = await sweepStuckSubmissions({
      olderThanMinutes: req.body?.olderThanMinutes,
      limit: req.body?.limit,
      dryRun: req.body?.dryRun,
    });
    return res.json({
      ok: true,
      thresholdMinutes: req.body?.olderThanMinutes ?? getStuckThresholdMinutes(),
      limit: req.body?.limit ?? getSweepLimit(),
      dryRun: !!req.body?.dryRun,
      result,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Failed to sweep stuck submissions" });
  }
});

// -------------------------
// Micro-live reporting (admin-only, one at a time)
// -------------------------

const MICRO_LIVE_INTERVAL_MS =
  (Number(process.env.REPORTING_MICROLIVE_MIN_INTERVAL_SECONDS || 60) || 60) * 1000;
let lastMicroLiveAt = 0;

router.get("/reporting/micro-live/eligible", async (req, res) => {
  const landlordIdFilter = req.query.landlordId as string | undefined;
  const tenantIdFilter = req.query.tenantId as string | undefined;
  const limit = Number(req.query.limit || 20);

  const allow = getPilotLandlordAllowlist();

  let query: FirebaseFirestore.Query = db.collection("reportingSubmissions");
  query = query.where("status", "in", ["validated", "submitted"]);
  if (landlordIdFilter) query = query.where("landlordId", "==", landlordIdFilter);
  if (tenantIdFilter) query = query.where("tenantId", "==", tenantIdFilter);
  query = query.orderBy("createdAt", "desc").limit(limit);

  const snap = await query.get();
  const submissions = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as any) }))
    .filter((s) => (!allow.length ? true : allow.includes(String(s.landlordId))))
    .filter((s) => s.consentId);

  const safe = submissions.map((s) => ({
    id: s.id,
    landlordId: s.landlordId,
    tenantId: s.tenantId,
    period: s.period,
    providerKey: s.providerKey,
    payloadVersion: s.payloadVersion,
    status: s.status,
    dryRun: !!s.dryRun,
    createdAt: s.createdAt,
    lastError: s.lastError ?? null,
  }));

  return res.json({ ok: true, submissions: safe });
});

router.post("/reporting/micro-live/approve", async (req: any, res) => {
  const submissionId = req.body?.submissionId;
  if (!submissionId) return res.status(400).json({ error: "submissionId required" });
  const ref = db.collection("reportingSubmissions").doc(submissionId);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: "not found" });
  const data = snap.data() as any;
  if (!["validated", "submitted"].includes(data.status)) {
    return res.status(409).json({ error: "Not eligible for approval" });
  }
  const allow = getPilotLandlordAllowlist();
  if (allow.length && !allow.includes(String(data.landlordId))) {
    return res.status(403).json({ error: "Not in pilot allowlist" });
  }
  const now = new Date().toISOString();
  await ref.update({
    liveApprovedAt: now,
    liveApprovedBy: req.user?.email || req.user?.id || "admin",
  });
  return res.json({
    ok: true,
    submissionId,
    liveApprovedAt: now,
    liveApprovedBy: req.user?.email || req.user?.id || "admin",
  });
});

router.post("/reporting/micro-live/submit", async (req: any, res) => {
  const submissionId = req.body?.submissionId;
  if (!submissionId) return res.status(400).json({ error: "submissionId required" });

  const now = Date.now();
  if (now - lastMicroLiveAt < MICRO_LIVE_INTERVAL_MS) {
    return res.status(429).json({ error: "Rate limited. Wait and retry." });
  }

  const cfg = await getReportingRuntimeConfig();
  if (!cfg.enabled) return res.status(503).json({ error: "Reporting paused", paused: true });
  if (cfg.dryRun) return res.status(409).json({ error: "Live reporting disabled in Phase 3.2A. Set REPORTING_DRY_RUN=false." });

  const ref = db.collection("reportingSubmissions").doc(submissionId);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: "not found" });
  const data = snap.data() as any;

  if (["accepted", "rejected", "failed_final"].includes(data.status)) {
    return res.json({ ok: true, noop: true, status: data.status });
  }
  if (!["validated", "submitted", "queued"].includes(data.status)) {
    return res.status(409).json({ error: "Not eligible for live submit", status: data.status });
  }
  if (!data.liveApprovedAt) {
    return res.status(403).json({ error: "Not approved for live submit" });
  }

  const consentId = data.audit?.consentId;
  if (!consentId) return res.status(409).json({ error: "Missing consent reference" });
  const consentSnap = await db.collection("reportingConsents").doc(consentId).get();
  if (!consentSnap.exists) return res.status(409).json({ error: "Consent not found" });
  const consent = consentSnap.data() as any;
  if (consent.status !== "granted") return res.status(403).json({ error: "Consent not granted" });
  if (consent.tenantId !== data.tenantId || consent.landlordId !== data.landlordId) {
    return res.status(403).json({ error: "Consent mismatch" });
  }

  const provider = getProvider(data.providerKey || "mock");
  try {
    provider.validateConfig();
  } catch (err: any) {
    return res.status(412).json({ error: err?.message || "Provider config invalid" });
  }

  // Lock
  if (data.status === "processing") {
    return res.status(409).json({ error: "Already processing" });
  }
  const lockId = uuid();
  await ref.update({
    status: "processing",
    processingStartedAt: new Date().toISOString(),
    processingLockId: lockId,
  });

  const maxAttempts = cfg.maxAttempts || 3;
  const attempt = (data.attempts || 0) + 1;

  const history = await getTenantCreditHistory({
    tenantId: data.tenantId,
    landlordId: data.landlordId,
    months: 12,
  });
  const records = toMetro2LikeRecords({
    tenantId: data.tenantId,
    landlordId: data.landlordId,
    leaseId: history.leaseId,
    periods: history.periods.filter((p) => p.period === data.period),
  });
  const payload = provider.buildPayload({ records, meta: { submissionId, live: true } });
  const payloadHash = hashPayload(payload);
  const creditHash = hashPayload(history);
  if (data.audit?.creditHistoryHash && data.audit.creditHistoryHash !== creditHash) {
    await ref.update({
      status: "failed_retryable",
      attempts: attempt,
      lastError: "hash_mismatch",
      processingStartedAt: null,
      processingLockId: null,
    });
    return res.status(409).json({ error: "hash_mismatch" });
  }

  // Submit live
  try {
    createLedgerEvent({
      tenantId: data.tenantId,
      landlordId: data.landlordId,
      type: "reporting_submitted",
      amountDelta: 0,
      occurredAt: new Date().toISOString(),
      reference: { kind: "reportingSubmission", id: submissionId },
      meta: { submissionId, period: data.period, providerKey: data.providerKey, consentId },
    });
    const result = await provider.submit(payload);
    const status =
      result.status === "accepted"
        ? "accepted"
        : result.status === "rejected"
        ? "rejected"
        : attempt >= maxAttempts
        ? "failed_final"
        : "failed_retryable";

    const update: any = {
      status,
      attempts: attempt,
      providerResponse: result,
      submittedAt: new Date().toISOString(),
      acceptedAt: status === "accepted" ? new Date().toISOString() : null,
      rejectedAt: status === "rejected" ? new Date().toISOString() : null,
      lastError: result.message || null,
      processingStartedAt: null,
      processingLockId: null,
      dryRun: false,
      liveMode: true,
      audit: {
        ...data.audit,
        payloadHash,
        creditHistoryHash: creditHash,
      },
    };
    await ref.update(update);

    createLedgerEvent({
      tenantId: data.tenantId,
      landlordId: data.landlordId,
      type:
        status === "accepted"
          ? "reporting_accepted"
          : status === "rejected"
          ? "reporting_rejected"
          : "reporting_failed",
      amountDelta: 0,
      occurredAt: new Date().toISOString(),
      reference: { kind: "reportingSubmission", id: submissionId },
      meta: { submissionId, period: data.period, providerKey: data.providerKey, consentId, status },
      notes: result.message || undefined,
    });

    lastMicroLiveAt = Date.now();
    return res.json({
      ok: true,
      submissionId,
      finalStatus: status,
      providerKey: data.providerKey,
      period: data.period,
      lastError: result.message || null,
    });
  } catch (err: any) {
    if (process.env.REPORTING_AUTO_PAUSE_ON_ERROR !== "false") {
      await setReportingPaused(true);
    }
    await ref.update({
      status: attempt >= maxAttempts ? "failed_final" : "failed_retryable",
      attempts: attempt,
      lastError: err?.message || "submit_error",
      processingStartedAt: null,
      processingLockId: null,
    });
    return res.status(500).json({ error: err?.message || "submit_error" });
  }
});

router.post("/reporting/replay", async (req, res) => {
  const tenantId = req.body?.tenantId;
  const months = Number(req.body?.months || 12);
  if (!tenantId) return res.status(400).json({ error: "tenantId required" });
  // noop placeholder for now
  return res.status(501).json({ error: "Replay not implemented in Phase 3.1A" });
});

export default router;
