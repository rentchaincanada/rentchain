import { Router } from "express";
import { db } from "../config/firebase";
import { requireAuth } from "../middleware/requireAuth";
import { requirePermission } from "../middleware/requireAuthz";
import { derivePlatformCredentialingReadiness } from "../lib/platformCredentialing/derivePlatformCredentialingReadiness";
import type {
  PlatformCredentialingReadiness,
  PlatformCredentialingStatus,
} from "../lib/platformCredentialing/platformCredentialingTypes";

const router = Router();

const READINESS_KEY = "institutional-platform-credentialing-readiness-v1";
const STATUSES = new Set<PlatformCredentialingStatus>([
  "ready_for_review",
  "partially_ready",
  "review_required",
  "blocked",
  "unknown",
]);

const PRIVACY_READINESS = [
  { privacyReadinessId: "privacy-compliance-governance-baseline", status: "ready_for_review" },
];

const CONSENT_GOVERNANCE = [
  { consentGovernanceId: "identity-consent-governance-baseline", status: "ready_for_review" },
];

function asString(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

async function loadCollection(collectionName: string, limit = 25) {
  const snap = await db.collection(collectionName).get().catch(() => null);
  return (snap?.docs || []).slice(0, limit).map((doc) => sanitizeRecord({ id: doc.id, ...((doc.data() as any) || {}) }));
}

function sanitizeRecord(record: Record<string, any>) {
  const safe: Record<string, any> = {};
  for (const key of [
    "id",
    "status",
    "state",
    "conclusion",
    "governanceReadinessId",
    "privacyReadinessId",
    "policyId",
    "consentGovernanceId",
    "consentId",
    "identityConsentId",
    "verificationReadinessId",
    "identityProfileId",
    "participantId",
    "adapterReadinessId",
    "controlledIntegrationId",
    "onboardingReadinessId",
    "institutionOnboardingId",
    "operationalRiskId",
    "releaseGovernanceId",
    "publicExposureHardeningId",
    "commercialReadinessId",
    "ecosystemCoordinationId",
    "evidencePackId",
    "reviewSessionId",
    "eventId",
    "eventType",
    "resourceType",
    "resourceId",
    "createdAt",
    "updatedAt",
    "redacted",
  ]) {
    if (record[key] !== undefined) safe[key] = record[key];
  }
  return safe;
}

async function buildPlatformCredentialingReadiness(): Promise<PlatformCredentialingReadiness[]> {
  const [
    governanceReadiness,
    privacyReadiness,
    consentGovernance,
    auditLineage,
    verificationReadiness,
    interoperabilityReadiness,
    controlledIntegrations,
    onboardingReadiness,
    operationalRiskProfiles,
    evidencePacks,
    reviews,
  ] = await Promise.all([
    Promise.all([
      loadCollection("releaseGovernanceProfiles"),
      loadCollection("publicExposureHardeningProfiles"),
      loadCollection("commercialReadinessProfiles"),
      loadCollection("ecosystemCoordinationSnapshots"),
    ]).then((groups) => groups.flat()),
    loadCollection("privacyReadiness"),
    loadCollection("consentGovernance"),
    loadCollection("events"),
    Promise.all([loadCollection("identityProfiles"), loadCollection("networkParticipantProfiles")]).then((groups) => groups.flat()),
    loadCollection("interoperabilityAdapterReadiness"),
    loadCollection("controlledIntegrationProfiles"),
    loadCollection("institutionOnboardingReadiness"),
    loadCollection("operationalRiskProfiles"),
    loadCollection("evidencePacks"),
    loadCollection("operatorReviewSessions"),
  ]);

  return [
    derivePlatformCredentialingReadiness({
      readinessKey: READINESS_KEY,
      governanceReadiness,
      privacyReadiness: privacyReadiness.length ? privacyReadiness : PRIVACY_READINESS,
      consentGovernance: consentGovernance.length ? consentGovernance : CONSENT_GOVERNANCE,
      auditLineage,
      verificationReadiness,
      interoperabilityReadiness: [...interoperabilityReadiness, ...controlledIntegrations],
      institutionOnboardingReadiness: onboardingReadiness,
      operationalRiskProfiles,
      evidencePacks,
      operatorReviewSessions: reviews,
    }),
  ];
}

function readinessMatches(readiness: PlatformCredentialingReadiness, id: string) {
  return readiness.platformCredentialingId === id;
}

router.get("/platform-credentialing-readiness", requireAuth, requirePermission("system.admin"), async (req: any, res) => {
  try {
    const status = asString(req.query?.status, 80) as PlatformCredentialingStatus;
    let readiness = await buildPlatformCredentialingReadiness();
    if (status && STATUSES.has(status)) readiness = readiness.filter((profile) => profile.status === status);
    return res.json({ ok: true, readiness });
  } catch (err: any) {
    console.error("[admin-platform-credentialing] list failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "PLATFORM_CREDENTIALING_READINESS_FAILED" });
  }
});

router.get("/platform-credentialing-readiness/:platformCredentialingId", requireAuth, requirePermission("system.admin"), async (req: any, res) => {
  try {
    const platformCredentialingId = decodeURIComponent(asString(req.params?.platformCredentialingId, 500));
    if (!platformCredentialingId) return res.status(400).json({ ok: false, error: "PLATFORM_CREDENTIALING_ID_REQUIRED" });
    const readiness = await buildPlatformCredentialingReadiness();
    const profile = readiness.find((next) => readinessMatches(next, platformCredentialingId));
    if (!profile) return res.status(404).json({ ok: false, error: "PLATFORM_CREDENTIALING_NOT_FOUND" });
    return res.json({ ok: true, readiness: profile });
  } catch (err: any) {
    console.error("[admin-platform-credentialing] get failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "PLATFORM_CREDENTIALING_GET_FAILED" });
  }
});

export default router;
