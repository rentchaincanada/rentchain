import { Router } from "express";
import { requireRole } from "../middleware/requireRole";
import { requirePermission } from "../middleware/requireAuthz";
import { db } from "../config/firebase";
import { getReportingRuntimeConfig, getPilotLandlordAllowlist } from "../services/reporting/reportingConfig";
import { getTenantCreditHistory } from "../services/tenantCreditProfileService";
import { hashPayload } from "../events/factory";
import { createLedgerEvent } from "../services/ledgerEventsService";
import { toMetro2LikeRecords } from "../services/creditReporting/metro2Model";
import { v4 as uuid } from "uuid";
import { getProvider } from "../services/creditReporting/providerFactory";

const router = Router();
router.use(requireRole("landlord"));

async function fetchConsent(tenantId: string, landlordId: string) {
  const snap = await db
    .collection("reportingConsents")
    .where("tenantId", "==", tenantId)
    .where("landlordId", "==", landlordId)
    .limit(1)
    .get();
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...(snap.docs[0].data() as any) };
}

router.post(
  "/reporting/invite",
  requireRole(["landlord", "admin"]),
  requirePermission("users.invite"),
  async (req: any, res) => {
  const tenantId = req.body?.tenantId;
  const landlordId = req.user?.landlordId || req.user?.id;
  if (!tenantId || !landlordId) return res.status(400).json({ error: "tenantId required" });

  try {
    const now = new Date().toISOString();
    await db.collection("reportingConsents").add({
      tenantId,
      landlordId,
      scope: "credit_reporting",
      status: "pending",
      createdAt: now,
      method: "portal_checkbox",
    });
    return res.json({
      status: "pending",
      consentUrl: `/tenant/reporting-consent?tenantId=${encodeURIComponent(tenantId)}`,
    });
  } catch (err) {
    console.error("[landlordReportingRoutes] invite error", err);
    return res.status(500).json({ error: "Failed to invite for consent" });
  }
  }
);

router.get(
  "/reporting/status",
  requireRole(["landlord", "admin"]),
  requirePermission("reports.view"),
  async (req: any, res) => {
  const tenantId = req.query.tenantId as string;
  const landlordId = req.user?.landlordId || req.user?.id;
  if (!tenantId || !landlordId) return res.status(400).json({ error: "tenantId required" });

  try {
    const consent = await fetchConsent(tenantId, landlordId);
    const submissionsSnap = await db
      .collection("reportingSubmissions")
      .where("tenantId", "==", tenantId)
      .where("landlordId", "==", landlordId)
      .orderBy("createdAt", "desc")
      .limit(5)
      .get();
    const submissions = submissionsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    return res.json({
      consentStatus: consent?.status ?? "pending",
      lastSubmission: submissions[0] ?? null,
      submissions,
    });
  } catch (err) {
    console.error("[landlordReportingRoutes] status error", err);
    return res.status(500).json({ error: "Failed to load status" });
  }
  }
);

router.post(
  "/reporting/queue",
  requireRole(["landlord", "admin"]),
  requirePermission("reports.export"),
  async (req: any, res) => {
  const tenantId = req.body?.tenantId;
  const months = Number(req.body?.months || 12);
  const providerKey = (req.body?.providerKey as string) || "mock";
  const landlordId = req.user?.landlordId || req.user?.id;
  if (!tenantId || !landlordId) return res.status(400).json({ error: "tenantId required" });

  const cfg = await getReportingRuntimeConfig();
  if (!cfg.enabled) return res.status(503).json({ error: "Reporting paused", paused: true });
  if (!cfg.dryRun) return res.status(409).json({ error: "Live reporting disabled in Phase 3.2A. Enable dryRun only." });
  if (!cfg.allowedProviders.includes(providerKey)) {
    return res.status(400).json({ error: "Provider not allowed" });
  }

  try {
    const consent = await fetchConsent(tenantId, landlordId);
    if (!consent || consent.status !== "granted") {
      return res.status(403).json({ error: "Consent required" });
    }
    const history = await getTenantCreditHistory({ tenantId, landlordId, months });
    const hash = hashPayload(history);
    const records = toMetro2LikeRecords({
      tenantId,
      landlordId,
      leaseId: history.leaseId,
      periods: history.periods,
    });

    const now = new Date().toISOString();
    const created: any[] = [];
    for (const period of history.periods.slice(-months)) {
      const payloadVersion = "1.0";
      const submissionKey = `${providerKey}:${payloadVersion}:${landlordId}:${tenantId}:${period.period}`;
      const existingSnap = await db
        .collection("reportingSubmissions")
        .where("submissionKey", "==", submissionKey)
        .limit(1)
        .get();
      if (!existingSnap.empty) {
        continue; // dedupe
      }
      const doc = {
        providerKey,
        landlordId,
        tenantId,
        leaseId: history.leaseId ?? null,
        period: period.period,
        payloadVersion,
        submissionKey,
        status: "queued",
        attempts: 0,
        lastError: null,
        submittedAt: null,
        processingStartedAt: null,
        processingLockId: null,
        createdAt: now,
        audit: {
          derivedFrom: "rentchain-ledger",
          creditHistoryHash: hash,
        },
        snapshot: cfg.dryRun ? { records } : null,
      };
      const ref = await db.collection("reportingSubmissions").add(doc);
      created.push({ id: ref.id, ...doc });
    }
    createLedgerEvent({
      tenantId,
      landlordId,
      type: "reporting_queued",
      amountDelta: 0,
      occurredAt: now,
      notes: `Queued reporting for last ${months} months`,
      meta: { months, providerKey },
    });
    return res.json({ ok: true, created: created.length });
  } catch (err) {
    console.error("[landlordReportingRoutes] queue error", err);
    return res.status(500).json({ error: "Failed to queue reporting" });
  }
  }
);

export default router;
