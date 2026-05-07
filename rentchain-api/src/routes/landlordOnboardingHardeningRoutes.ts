import { Router } from "express";
import { db } from "../config/firebase";
import { requireAuth } from "../middleware/requireAuth";
import { requireLandlord } from "../middleware/requireLandlord";
import { deriveOnboardingHardeningProfile } from "../lib/onboardingHardening/deriveOnboardingHardeningProfile";
import type { OnboardingHardeningProfile, OnboardingHardeningStatus } from "../lib/onboardingHardening/onboardingHardeningTypes";

const router = Router();
const STATUSES = new Set<OnboardingHardeningStatus>(["ready_for_review", "partially_ready", "review_required", "blocked", "unknown"]);

function asString(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

function landlordIdFromReq(req: any) {
  return asString(req.user?.landlordId || req.user?.id || req.user?.sub, 240);
}

function sanitizeRecord(record: Record<string, any>) {
  const safe: Record<string, any> = {};
  for (const key of [
    "id",
    "status",
    "state",
    "conclusion",
    "landlordId",
    "ownerId",
    "userId",
    "createdByLandlordId",
    "applicationId",
    "inviteId",
    "onboardingId",
    "stepId",
    "profileId",
    "profileReadinessId",
    "screeningReadinessId",
    "screeningOrderId",
    "integrationReadinessId",
    "integrationId",
    "adapterId",
    "connectionId",
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

async function loadLandlordCollection(collectionName: string, landlordId: string, limit = 25) {
  const byId = new Map<string, any>();
  async function collect(field: "landlordId" | "ownerId" | "userId" | "createdByLandlordId") {
    const snap = await db.collection(collectionName).where(field, "==", landlordId).get().catch(() => null);
    for (const doc of snap?.docs || []) byId.set(doc.id, sanitizeRecord({ id: doc.id, ...((doc.data() as any) || {}) }));
  }
  await Promise.all([collect("landlordId"), collect("ownerId"), collect("userId"), collect("createdByLandlordId")]);
  return Array.from(byId.values())
    .filter((record) => [record.landlordId, record.ownerId, record.userId, record.createdByLandlordId].some((value) => asString(value, 240) === landlordId))
    .slice(0, limit);
}

async function buildLandlordOnboardingHardeningProfiles(landlordId: string): Promise<OnboardingHardeningProfile[]> {
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
    Promise.all([
      loadLandlordCollection("properties", landlordId),
      loadLandlordCollection("units", landlordId),
      loadLandlordCollection("tenantInvites", landlordId),
      loadLandlordCollection("rentalApplications", landlordId),
    ]).then((groups) => groups.flat()),
    Promise.all([loadLandlordCollection("landlordProfiles", landlordId), loadLandlordCollection("accountProfiles", landlordId), loadLandlordCollection("landlords", landlordId)]).then((groups) => groups.flat()),
    Promise.all([loadLandlordCollection("screeningOrders", landlordId), loadLandlordCollection("transUnionIntegrations", landlordId)]).then((groups) => groups.flat()),
    Promise.all([loadLandlordCollection("interoperabilityAdapterReadiness", landlordId), loadLandlordCollection("controlledIntegrationProfiles", landlordId)]).then((groups) => groups.flat()),
    Promise.all([loadLandlordCollection("events", landlordId), loadLandlordCollection("adminAlerts", landlordId)]).then((groups) => groups.flat()),
    loadLandlordCollection("operatorReviewSessions", landlordId),
    loadLandlordCollection("evidencePacks", landlordId),
    loadLandlordCollection("events", landlordId),
  ]);

  return [
    deriveOnboardingHardeningProfile({
      participantType: "landlord",
      participantId: landlordId,
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

router.get("/onboarding-hardening", requireAuth, requireLandlord, async (req: any, res) => {
  try {
    const landlordId = landlordIdFromReq(req);
    if (!landlordId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    const participantType = asString(req.query?.participantType, 80).toLowerCase();
    const status = asString(req.query?.status, 80) as OnboardingHardeningStatus;
    let profiles = participantType && participantType !== "landlord" ? [] : await buildLandlordOnboardingHardeningProfiles(landlordId);
    if (status && STATUSES.has(status)) profiles = profiles.filter((profile) => profile.status === status);
    return res.json({ ok: true, profiles });
  } catch (err: any) {
    console.error("[landlord-onboarding-hardening] list failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "LANDLORD_ONBOARDING_HARDENING_FAILED" });
  }
});

export default router;
