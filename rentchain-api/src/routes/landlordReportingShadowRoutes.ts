import { Router } from "express";
import { requireRole } from "../middleware/requireRole";
import { db } from "../config/firebase";
import { getReportingRuntimeConfig, getPilotLandlordAllowlist } from "../services/reporting/reportingConfig";
import { getTenantCreditHistory } from "../services/tenantCreditProfileService";
import { hashPayload } from "../events/factory";
import { getProvider } from "../services/creditReporting/providerFactory";

const router = Router();
router.use(requireRole("landlord"));

async function fetchConsent(tenantId: string, landlordId: string) {
  // Prefer granted if exists, otherwise pending
  const grantedSnap = await db
    .collection("reportingConsents")
    .where("tenantId", "==", tenantId)
    .where("landlordId", "==", landlordId)
    .where("status", "==", "granted")
    .orderBy("createdAt", "desc")
    .limit(1)
    .get();
  if (!grantedSnap.empty) {
    return { id: grantedSnap.docs[0].id, ...(grantedSnap.docs[0].data() as any) };
  }
  const pendingSnap = await db
    .collection("reportingConsents")
    .where("tenantId", "==", tenantId)
    .where("landlordId", "==", landlordId)
    .where("status", "==", "pending")
    .orderBy("createdAt", "desc")
    .limit(1)
    .get();
  if (!pendingSnap.empty) {
    return { id: pendingSnap.docs[0].id, ...(pendingSnap.docs[0].data() as any) };
  }
  return null;
}

function checkPilotAllowlist(landlordId: string): boolean {
  const allow = getPilotLandlordAllowlist();
  if (!allow.length) return true; // dev open
  return allow.includes(String(landlordId));
}

router.post("/reporting/shadow/prepare", async (req: any, res) => {
  const landlordId = req.user?.landlordId || req.user?.id;
  const tenantId = req.body?.tenantId;
  const months = Number(req.body?.months || 3);
  const providerKey = (req.body?.providerKey as string) || "mock";

  if (!tenantId || !landlordId) return res.status(400).json({ error: "tenantId required" });
  if (!checkPilotAllowlist(landlordId)) return res.status(403).json({ error: "Not in pilot allowlist" });

  const cfg = await getReportingRuntimeConfig();
  if (!cfg.enabled) return res.status(503).json({ error: "Reporting paused", paused: true });
  if (!cfg.dryRun) return res.status(409).json({ error: "Live reporting disabled in Phase 3.2A. Enable dryRun only." });

  const consent = await fetchConsent(tenantId, landlordId);
  if (!consent || consent.status !== "granted") {
    return res.status(403).json({ error: "Consent required", consentStatus: consent?.status || "none" });
  }

  try {
    const history = await getTenantCreditHistory({ tenantId, landlordId, months });
    const provider = getProvider(providerKey);
    const creditHistoryHash = hashPayload(history);
    let created = 0;
    let validated = 0;
    let rejected = 0;
    const sampleSubmissionIds: string[] = [];

    for (const period of history.periods.slice(-months)) {
      const payloadVersion = "1.0";
      const submissionKey = `${providerKey}:${payloadVersion}:${landlordId}:${tenantId}:${period.period}`;
      const existingSnap = await db
        .collection("reportingSubmissions")
        .where("submissionKey", "==", submissionKey)
        .limit(1)
        .get();
      if (!existingSnap.empty) continue;

      let status = "submitted";
      let lastError: string | null = null;
      let payloadHash: string | null = null;
      try {
        const records = [
          {
            tenantRef: tenantId,
            landlordRef: landlordId,
            accountRef: history.leaseId ?? null,
            period: period.period,
            amountDue: period.rentAmount ?? null,
            amountPaid: period.amountPaid ?? 0,
            daysLate: period.daysLate ?? null,
            statusCode: period.status,
            asOfDate: period.dueDate ?? period.period,
          },
        ];
        const payload = provider.buildPayload({ records, meta: { submissionKey, shadow: true } });
        payloadHash = hashPayload(payload);
        validated += 1;
      } catch (err: any) {
        status = "rejected";
        lastError = err?.message || "validation_error";
        rejected += 1;
      }

      const now = new Date().toISOString();
      const doc = {
        providerKey,
        landlordId,
        tenantId,
        leaseId: history.leaseId ?? null,
        period: period.period,
        payloadVersion,
        submissionKey,
        status,
        dryRun: true,
        attempts: 0,
        lastError,
        submittedAt: now,
        processingStartedAt: null,
        processingLockId: null,
        createdAt: now,
        audit: {
          derivedFrom: "rentchain-ledger",
          creditHistoryHash,
          payloadHash: payloadHash ?? null,
          consentId: consent.id,
        },
        snapshot: null,
      };
      const ref = await db.collection("reportingSubmissions").add(doc);
      created += 1;
      if (sampleSubmissionIds.length < 5) sampleSubmissionIds.push(ref.id);
    }

    return res.json({
      ok: true,
      tenantId,
      months,
      created,
      validated,
      rejected,
      sampleSubmissionIds,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "shadow prepare failed" });
  }
});

router.get("/reporting/shadow/status", async (req: any, res) => {
  const landlordId = req.user?.landlordId || req.user?.id;
  const tenantId = req.query.tenantId as string;
  if (!tenantId || !landlordId) return res.status(400).json({ error: "tenantId required" });
  if (!checkPilotAllowlist(landlordId)) return res.status(403).json({ error: "Not in pilot allowlist" });

  const consent = await fetchConsent(tenantId, landlordId);
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const snap = await db
    .collection("reportingSubmissions")
    .where("tenantId", "==", tenantId)
    .where("landlordId", "==", landlordId)
    .where("createdAt", ">=", since)
    .orderBy("createdAt", "desc")
    .limit(10)
    .get();

  const submissions = snap.docs.map((d) => {
    const x = d.data() as any;
    return {
      id: d.id,
      period: x.period,
      status: x.status,
      lastError: x.lastError ?? null,
      createdAt: x.createdAt,
    };
  });

  const counts: Record<string, number> = {};
  submissions.forEach((s) => {
    counts[s.status] = (counts[s.status] || 0) + 1;
  });

  return res.json({
    consentStatus: consent?.status ?? "none",
    lastPreparedAt: submissions[0]?.createdAt ?? null,
    counts,
    submissions,
  });
});

export default router;
