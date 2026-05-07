import { Router } from "express";
import { db } from "../config/firebase";
import { requireAuth } from "../middleware/requireAuth";
import { requirePermission } from "../middleware/requireAuthz";
import { derivePublicExposureHardeningProfile } from "../lib/publicExposureHardening/derivePublicExposureHardeningProfile";
import type {
  PublicExposureHardeningProfile,
  PublicExposureHardeningStatus,
} from "../lib/publicExposureHardening/publicExposureHardeningTypes";

const router = Router();

const HARDENING_KEY = "controlled-production-exposure-readiness-v1";
const STATUSES = new Set<PublicExposureHardeningStatus>(["ready_for_review", "partially_ready", "review_required", "blocked", "unknown"]);

const ROLLBACK_ARTIFACTS = [
  { artifactId: "release-governance-rollback-checklist", status: "verified", path: "docs/releases/release-governance-baseline.md" },
];

const SECURITY_READINESS = [
  { securityReadinessId: "admin-route-permission-scope", status: "verified" },
  { securityReadinessId: "sensitive-payload-redaction-boundary", status: "verified" },
];

const SUPPORT_READINESS = [
  { supportReadinessId: "support-console-readiness-visibility", status: "ready_for_review" },
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
    "eventId",
    "eventType",
    "resourceType",
    "resourceId",
    "releaseGovernanceId",
    "releaseVersion",
    "rollbackId",
    "artifactId",
    "path",
    "securityReadinessId",
    "checkId",
    "supportReadinessId",
    "supportId",
    "operationalRiskId",
    "onboardingReadinessId",
    "evidencePackId",
    "reviewSessionId",
    "generatedAt",
    "createdAt",
    "updatedAt",
    "redacted",
  ]) {
    if (record[key] !== undefined) safe[key] = record[key];
  }
  return safe;
}

async function buildPublicExposureHardeningProfiles(): Promise<PublicExposureHardeningProfile[]> {
  const [releaseGovernanceProfiles, operationalRiskProfiles, onboardingReadiness, evidencePacks, reviews, auditEvents, rollbackArtifacts, securityReadiness, supportReadiness] =
    await Promise.all([
      loadCollection("releaseGovernanceProfiles"),
      loadCollection("operationalRiskProfiles"),
      loadCollection("institutionOnboardingReadiness"),
      loadCollection("evidencePacks"),
      loadCollection("operatorReviewSessions"),
      loadCollection("events"),
      loadCollection("rollbackReadinessArtifacts"),
      loadCollection("securityReadiness"),
      loadCollection("supportReadiness"),
    ]);

  return [
    derivePublicExposureHardeningProfile({
      hardeningKey: HARDENING_KEY,
      releaseGovernanceProfiles,
      rollbackArtifacts: rollbackArtifacts.length ? rollbackArtifacts : ROLLBACK_ARTIFACTS,
      securityReadiness: securityReadiness.length ? securityReadiness : SECURITY_READINESS,
      operationalRiskProfiles,
      institutionOnboardingReadiness: onboardingReadiness,
      supportReadiness: supportReadiness.length ? supportReadiness : SUPPORT_READINESS,
      evidencePacks,
      operatorReviewSessions: reviews,
      auditEvents,
    }),
  ];
}

function profileMatches(profile: PublicExposureHardeningProfile, id: string) {
  return profile.publicExposureHardeningId === id;
}

router.get("/public-exposure-hardening", requireAuth, requirePermission("system.admin"), async (req: any, res) => {
  try {
    const status = asString(req.query?.status, 80) as PublicExposureHardeningStatus;
    let profiles = await buildPublicExposureHardeningProfiles();
    if (status && STATUSES.has(status)) profiles = profiles.filter((profile) => profile.status === status);
    return res.json({ ok: true, profiles });
  } catch (err: any) {
    console.error("[admin-public-exposure-hardening] list failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "PUBLIC_EXPOSURE_HARDENING_FAILED" });
  }
});

router.get("/public-exposure-hardening/:publicExposureHardeningId", requireAuth, requirePermission("system.admin"), async (req: any, res) => {
  try {
    const publicExposureHardeningId = decodeURIComponent(asString(req.params?.publicExposureHardeningId, 500));
    if (!publicExposureHardeningId) return res.status(400).json({ ok: false, error: "PUBLIC_EXPOSURE_HARDENING_ID_REQUIRED" });
    const profiles = await buildPublicExposureHardeningProfiles();
    const profile = profiles.find((next) => profileMatches(next, publicExposureHardeningId));
    if (!profile) return res.status(404).json({ ok: false, error: "PUBLIC_EXPOSURE_HARDENING_NOT_FOUND" });
    return res.json({ ok: true, profile });
  } catch (err: any) {
    console.error("[admin-public-exposure-hardening] get failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "PUBLIC_EXPOSURE_HARDENING_GET_FAILED" });
  }
});

export default router;
