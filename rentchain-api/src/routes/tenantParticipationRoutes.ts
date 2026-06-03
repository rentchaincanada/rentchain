import { Router } from "express";
import { db } from "../firebase";
import { authenticateJwt } from "../middleware/authMiddleware";
import { deriveTenantParticipationProfile } from "../lib/tenantParticipation/deriveTenantParticipationProfile";
import type { TenantParticipationProfile, TenantParticipationStatus } from "../lib/tenantParticipation/tenantParticipationTypes";

const router = Router();
router.use(authenticateJwt);

const STATUSES = new Set<TenantParticipationStatus>(["verified", "partially_verified", "review_required", "blocked", "unknown"]);

function asString(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

function requireTenant(req: any, res: any, next: any) {
  const user = req.user;
  const role = asString(user?.role, 80).toLowerCase();
  const tenantId = asString(user?.tenantId, 240);
  if (!user || role !== "tenant" || !tenantId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
  return next();
}

function belongsToTenant(record: Record<string, any>, tenantId: string) {
  const tenantIds = Array.isArray(record.tenantIds) ? record.tenantIds.map((item) => asString(item, 240)) : [];
  return [record.tenantId, record.primaryTenantId, record.applicantTenantId, record.identityId, record.resourceId, record.id]
    .map((value) => asString(value, 240))
    .concat(tenantIds)
    .includes(tenantId);
}

async function loadTenantCollection(collectionName: string, tenantId: string, limit = 25) {
  const snap = await db.collection(collectionName).get().catch(() => null);
  return (snap?.docs || [])
    .slice(0, 200)
    .map((doc) => sanitizeRecord({ id: doc.id, ...((doc.data() as any) || {}) }))
    .filter((record) => belongsToTenant(record, tenantId))
    .slice(0, limit);
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
    "applicationId",
    "onboardingId",
    "paymentConsistencyId",
    "ledgerEventId",
    "paymentId",
    "rentalHistoryLedgerId",
    "leaseId",
    "occupancyId",
    "maintenanceRequestId",
    "workOrderId",
    "reviewSessionId",
    "operatorReviewId",
    "disputeResolutionId",
    "disputeId",
    "caseId",
    "communicationId",
    "messageId",
    "noticeId",
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

async function buildTenantParticipationProfiles(tenantId: string): Promise<TenantParticipationProfile[]> {
  const [
    onboardingRecords,
    paymentConsistencyRecords,
    occupancyRecords,
    maintenanceRecords,
    reviewRecords,
    disputeRecords,
    communicationRecords,
    evidencePacks,
    auditEvents,
  ] = await Promise.all([
    loadTenantCollection("rentalApplications", tenantId),
    loadTenantCollection("ledgerEvents", tenantId),
    loadTenantCollection("verifiedRentalHistoryLedgers", tenantId),
    loadTenantCollection("maintenanceRequests", tenantId),
    loadTenantCollection("operatorReviewSessions", tenantId),
    loadTenantCollection("disputeResolutionReadiness", tenantId),
    Promise.all([loadTenantCollection("tenantMessages", tenantId), loadTenantCollection("tenantNotices", tenantId)]).then((groups) => groups.flat()),
    loadTenantCollection("evidencePacks", tenantId),
    loadTenantCollection("events", tenantId),
  ]);

  return [
    deriveTenantParticipationProfile({
      tenantId,
      onboardingRecords,
      paymentConsistencyRecords,
      occupancyRecords,
      maintenanceRecords,
      reviewRecords,
      disputeRecords,
      communicationRecords,
      evidencePacks,
      auditEvents,
    }),
  ];
}

router.get("/participation-profile", requireTenant, async (req: any, res) => {
  try {
    const tenantId = asString(req.user?.tenantId, 240);
    const status = asString(req.query?.status, 80) as TenantParticipationStatus;
    let profiles = await buildTenantParticipationProfiles(tenantId);
    if (status && STATUSES.has(status)) profiles = profiles.filter((profile) => profile.status === status);
    return res.json({ ok: true, profiles });
  } catch (err: any) {
    console.error("[tenant-participation] list failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "TENANT_PARTICIPATION_FAILED" });
  }
});

router.get("/participation-profile/:tenantParticipationId", requireTenant, async (req: any, res) => {
  try {
    const tenantId = asString(req.user?.tenantId, 240);
    const tenantParticipationId = decodeURIComponent(asString(req.params?.tenantParticipationId, 500));
    if (!tenantParticipationId) return res.status(400).json({ ok: false, error: "TENANT_PARTICIPATION_ID_REQUIRED" });
    const profiles = await buildTenantParticipationProfiles(tenantId);
    const profile = profiles.find((next) => next.tenantParticipationId === tenantParticipationId);
    if (!profile) return res.status(404).json({ ok: false, error: "TENANT_PARTICIPATION_NOT_FOUND" });
    return res.json({ ok: true, profile });
  } catch (err: any) {
    console.error("[tenant-participation] get failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "TENANT_PARTICIPATION_GET_FAILED" });
  }
});

export default router;
