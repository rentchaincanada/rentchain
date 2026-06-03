import { Router } from "express";
import { db } from "../firebase";
import { authenticateJwt } from "../middleware/authMiddleware";
import { deriveOnboardingHardeningProfile } from "../lib/onboardingHardening/deriveOnboardingHardeningProfile";
import type { OnboardingHardeningProfile, OnboardingHardeningStatus } from "../lib/onboardingHardening/onboardingHardeningTypes";

const router = Router();
router.use(authenticateJwt);

const STATUSES = new Set<OnboardingHardeningStatus>(["ready_for_review", "partially_ready", "review_required", "blocked", "unknown"]);

function asString(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

function requireTenant(req: any, res: any, next: any) {
  const user = req.user;
  const role = asString(user?.role, 80).toLowerCase();
  const tenantId = asString(user?.tenantId || user?.id, 240);
  if (!user || role !== "tenant" || !tenantId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
  req.user.tenantId = tenantId;
  return next();
}

function belongsToTenant(record: Record<string, any>, tenantId: string) {
  const tenantIds = Array.isArray(record.tenantIds) ? record.tenantIds.map((item) => asString(item, 240)) : [];
  return [record.tenantId, record.primaryTenantId, record.applicantTenantId, record.identityId, record.resourceId, record.userId, record.id]
    .map((value) => asString(value, 240))
    .concat(tenantIds)
    .includes(tenantId);
}

function sanitizeRecord(record: Record<string, any>) {
  const safe: Record<string, any> = {};
  for (const key of [
    "id",
    "status",
    "state",
    "conclusion",
    "tenantId",
    "tenantIds",
    "primaryTenantId",
    "applicantTenantId",
    "identityId",
    "resourceId",
    "userId",
    "applicationId",
    "inviteId",
    "onboardingId",
    "profileId",
    "profileReadinessId",
    "screeningReadinessId",
    "screeningOrderId",
    "integrationReadinessId",
    "integrationId",
    "adapterId",
    "frictionId",
    "alertId",
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

async function loadTenantCollection(collectionName: string, tenantId: string, limit = 25) {
  const snap = await db.collection(collectionName).get().catch(() => null);
  return (snap?.docs || [])
    .slice(0, 250)
    .map((doc) => sanitizeRecord({ id: doc.id, ...((doc.data() as any) || {}) }))
    .filter((record) => belongsToTenant(record, tenantId))
    .slice(0, limit);
}

async function buildTenantOnboardingHardeningProfiles(tenantId: string): Promise<OnboardingHardeningProfile[]> {
  const [
    completionRecords,
    profileRecords,
    screeningReadinessRecords,
    integrationReadinessRecords,
    frictionRecords,
    reviewRecords,
    evidencePacks,
    auditEvents,
  ] = await Promise.all([
    Promise.all([loadTenantCollection("rentalApplications", tenantId), loadTenantCollection("tenantInvites", tenantId)]).then((groups) => groups.flat()),
    Promise.all([loadTenantCollection("tenantProfiles", tenantId), loadTenantCollection("tenants", tenantId)]).then((groups) => groups.flat()),
    Promise.all([loadTenantCollection("screeningOrders", tenantId), loadTenantCollection("tenantScreeningStatuses", tenantId)]).then((groups) => groups.flat()),
    Promise.all([loadTenantCollection("tenantAccessGrants", tenantId), loadTenantCollection("consents", tenantId)]).then((groups) => groups.flat()),
    Promise.all([loadTenantCollection("events", tenantId), loadTenantCollection("adminAlerts", tenantId)]).then((groups) => groups.flat()),
    loadTenantCollection("operatorReviewSessions", tenantId),
    loadTenantCollection("evidencePacks", tenantId),
    loadTenantCollection("events", tenantId),
  ]);

  return [
    deriveOnboardingHardeningProfile({
      participantType: "tenant",
      participantId: tenantId,
      completionRecords,
      profileRecords,
      screeningReadinessRecords,
      integrationReadinessRecords,
      frictionRecords,
      reviewRecords,
      evidencePacks,
      auditEvents,
    }),
  ];
}

router.get("/onboarding-hardening", requireTenant, async (req: any, res) => {
  try {
    const tenantId = asString(req.user?.tenantId, 240);
    const participantType = asString(req.query?.participantType, 80).toLowerCase();
    const status = asString(req.query?.status, 80) as OnboardingHardeningStatus;
    let profiles = participantType && participantType !== "tenant" ? [] : await buildTenantOnboardingHardeningProfiles(tenantId);
    if (status && STATUSES.has(status)) profiles = profiles.filter((profile) => profile.status === status);
    return res.json({ ok: true, profiles });
  } catch (err: any) {
    console.error("[tenant-onboarding-hardening] list failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "TENANT_ONBOARDING_HARDENING_FAILED" });
  }
});

export default router;
