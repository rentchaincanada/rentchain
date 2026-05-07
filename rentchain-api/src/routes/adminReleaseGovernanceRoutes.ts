import { Router } from "express";
import { db } from "../config/firebase";
import { requireAuth } from "../middleware/requireAuth";
import { requirePermission } from "../middleware/requireAuthz";
import { deriveReleaseGovernanceProfile } from "../lib/releaseGovernance/deriveReleaseGovernanceProfile";
import type { ReleaseGovernanceProfile, ReleaseGovernanceStatus } from "../lib/releaseGovernance/releaseGovernanceTypes";

const router = Router();

const DEFAULT_RELEASE_VERSION = "v0.9.0-core-foundation";
const STATUSES = new Set<ReleaseGovernanceStatus>(["ready_for_review", "partially_ready", "review_required", "blocked", "unknown"]);

const RELEASE_ARTIFACTS = [
  { artifactId: "release-notes-v0.9.0-core-foundation", status: "verified", path: "docs/releases/v0.9.0-core-foundation.md" },
  { artifactId: "release-governance-baseline", status: "verified", path: "docs/releases/release-governance-baseline.md" },
  { artifactId: "public-exposure-readiness-checklist", status: "verified", path: "docs/releases/public-exposure-readiness-checklist.md" },
  { artifactId: "platform-state-v0.9.0-core-foundation", status: "verified", path: "docs/architecture/platform-state-v0.9.0-core-foundation.md" },
];

const ROLLBACK_ARTIFACTS = [{ artifactId: "release-governance-rollback-checklist", status: "verified", path: "docs/releases/release-governance-baseline.md" }];

const DEPLOYMENT_CHECKS = [
  { checkId: "ci-backend", name: "ci/backend", status: "pending_review" },
  { checkId: "ci-frontend", name: "ci/frontend", status: "pending_review" },
  { checkId: "merge-gate", name: "merge-gate", status: "pending_review" },
  { checkId: "codex-pr-review", name: "codex-pr-review", status: "pending_review" },
  { checkId: "vercel", name: "Vercel", status: "pending_review" },
  { checkId: "terraform", name: "Terraform", status: "pending_review" },
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
    "eventId",
    "eventType",
    "resourceType",
    "resourceId",
    "evidencePackId",
    "reviewSessionId",
    "operationalRiskId",
    "generatedAt",
    "createdAt",
    "updatedAt",
    "redacted",
  ]) {
    if (record[key] !== undefined) safe[key] = record[key];
  }
  return safe;
}

async function buildReleaseGovernanceProfiles(releaseVersion: string): Promise<ReleaseGovernanceProfile[]> {
  const [evidencePacks, reviews, auditEvents, operationalRiskProfiles, qaRecords] = await Promise.all([
    loadCollection("evidencePacks"),
    loadCollection("operatorReviewSessions"),
    loadCollection("events"),
    loadCollection("operationalRiskProfiles"),
    loadCollection("releaseQaRecords"),
  ]);

  return [
    deriveReleaseGovernanceProfile({
      releaseVersion,
      releaseArtifacts: RELEASE_ARTIFACTS,
      deploymentChecks: DEPLOYMENT_CHECKS,
      rollbackArtifacts: ROLLBACK_ARTIFACTS,
      qaRecords,
      operationalRiskProfiles,
      evidencePacks,
      operatorReviewSessions: reviews,
      auditEvents,
    }),
  ];
}

function profileMatches(profile: ReleaseGovernanceProfile, id: string) {
  return profile.releaseGovernanceId === id;
}

router.get("/release-governance", requireAuth, requirePermission("system.admin"), async (req: any, res) => {
  try {
    const releaseVersion = asString(req.query?.releaseVersion, 160) || DEFAULT_RELEASE_VERSION;
    const status = asString(req.query?.status, 80) as ReleaseGovernanceStatus;
    let profiles = await buildReleaseGovernanceProfiles(releaseVersion);
    if (status && STATUSES.has(status)) profiles = profiles.filter((profile) => profile.status === status);
    return res.json({ ok: true, profiles });
  } catch (err: any) {
    console.error("[admin-release-governance] list failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "RELEASE_GOVERNANCE_FAILED" });
  }
});

router.get("/release-governance/:releaseGovernanceId", requireAuth, requirePermission("system.admin"), async (req: any, res) => {
  try {
    const releaseVersion = asString(req.query?.releaseVersion, 160) || DEFAULT_RELEASE_VERSION;
    const releaseGovernanceId = decodeURIComponent(asString(req.params?.releaseGovernanceId, 500));
    if (!releaseGovernanceId) return res.status(400).json({ ok: false, error: "RELEASE_GOVERNANCE_ID_REQUIRED" });
    const profiles = await buildReleaseGovernanceProfiles(releaseVersion);
    const profile = profiles.find((next) => profileMatches(next, releaseGovernanceId));
    if (!profile) return res.status(404).json({ ok: false, error: "RELEASE_GOVERNANCE_NOT_FOUND" });
    return res.json({ ok: true, profile });
  } catch (err: any) {
    console.error("[admin-release-governance] get failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "RELEASE_GOVERNANCE_GET_FAILED" });
  }
});

export default router;
