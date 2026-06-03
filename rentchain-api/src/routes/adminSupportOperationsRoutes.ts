import { Router } from "express";
import { db } from "../firebase";
import { requireAuth } from "../middleware/requireAuth";
import { requirePermission } from "../middleware/requireAuthz";
import { deriveSupportOperationsProfile } from "../lib/supportOperations/deriveSupportOperationsProfile";
import type { SupportOperationsProfile, SupportOperationsStatus } from "../lib/supportOperations/supportOperationsTypes";

const router = Router();
const SUPPORT_OPERATIONS_KEY = "production-support-operations-console-v1";
const STATUSES = new Set<SupportOperationsStatus>(["stable", "attention_required", "review_required", "blocked", "unknown"]);

function asString(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

function sanitizeRecord(record: Record<string, any>) {
  const safe: Record<string, any> = {};
  for (const key of [
    "id",
    "status",
    "state",
    "conclusion",
    "severity",
    "supportTicketId",
    "ticketId",
    "triageId",
    "resolutionId",
    "assignmentId",
    "slaId",
    "resourceType",
    "resourceId",
    "onboardingHardeningId",
    "onboardingReadinessId",
    "onboardingId",
    "platformCredentialingId",
    "credentialingReadinessId",
    "observabilityIncidentReadinessId",
    "incidentId",
    "alertId",
    "operationalRiskProfileId",
    "riskId",
    "reviewSessionId",
    "operatorReviewId",
    "evidencePackId",
    "eventId",
    "eventType",
    "createdAt",
    "updatedAt",
    "occurredAt",
    "redacted",
  ]) {
    if (record[key] !== undefined) safe[key] = record[key];
  }
  return safe;
}

async function loadCollection(collectionName: string, limit = 30) {
  const snap = await db.collection(collectionName).get().catch(() => null);
  return (snap?.docs || []).slice(0, limit).map((doc) => sanitizeRecord({ id: doc.id, ...((doc.data() as any) || {}) }));
}

async function buildSupportOperationsProfiles(): Promise<SupportOperationsProfile[]> {
  const [
    supportRecords,
    onboardingRecords,
    credentialingRecords,
    incidentRecords,
    operationalRiskRecords,
    reviewRecords,
    evidencePacks,
    auditEvents,
  ] = await Promise.all([
    Promise.all([
      loadCollection("supportTickets"),
      loadCollection("adminTriageItems"),
      loadCollection("adminResolutions"),
      loadCollection("adminAssignments"),
      loadCollection("slaEvaluations"),
    ]).then((groups) => groups.flat()),
    Promise.all([loadCollection("onboardingHardeningProfiles"), loadCollection("institutionOnboardingReadiness")]).then((groups) => groups.flat()),
    Promise.all([loadCollection("platformCredentialingReadiness"), loadCollection("credentialingReadiness")]).then((groups) => groups.flat()),
    Promise.all([loadCollection("observabilityIncidentReadinessProfiles"), loadCollection("statusIncidents"), loadCollection("adminAlerts")]).then((groups) => groups.flat()),
    Promise.all([loadCollection("operationalRiskProfiles"), loadCollection("operationalRiskRestrictions")]).then((groups) => groups.flat()),
    loadCollection("operatorReviewSessions"),
    loadCollection("evidencePacks"),
    loadCollection("events"),
  ]);

  return [
    deriveSupportOperationsProfile({
      supportOperationsKey: SUPPORT_OPERATIONS_KEY,
      supportRecords,
      onboardingRecords,
      credentialingRecords,
      incidentRecords,
      operationalRiskRecords,
      reviewRecords,
      evidencePacks,
      auditEvents,
    }),
  ];
}

function profileMatches(profile: SupportOperationsProfile, id: string) {
  return profile.supportOperationsId === id;
}

router.get("/support-operations", requireAuth, requirePermission("system.admin"), async (req: any, res) => {
  try {
    const status = asString(req.query?.status, 80) as SupportOperationsStatus;
    let profiles = await buildSupportOperationsProfiles();
    if (status && STATUSES.has(status)) profiles = profiles.filter((profile) => profile.status === status);
    return res.json({ ok: true, profiles });
  } catch (err: any) {
    console.error("[admin-support-operations] list failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "SUPPORT_OPERATIONS_FAILED" });
  }
});

router.get("/support-operations/:supportOperationsId", requireAuth, requirePermission("system.admin"), async (req: any, res) => {
  try {
    const supportOperationsId = decodeURIComponent(asString(req.params?.supportOperationsId, 500));
    if (!supportOperationsId) return res.status(400).json({ ok: false, error: "SUPPORT_OPERATIONS_ID_REQUIRED" });
    const profiles = await buildSupportOperationsProfiles();
    const profile = profiles.find((next) => profileMatches(next, supportOperationsId));
    if (!profile) return res.status(404).json({ ok: false, error: "SUPPORT_OPERATIONS_NOT_FOUND" });
    return res.json({ ok: true, profile });
  } catch (err: any) {
    console.error("[admin-support-operations] get failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "SUPPORT_OPERATIONS_GET_FAILED" });
  }
});

export default router;
