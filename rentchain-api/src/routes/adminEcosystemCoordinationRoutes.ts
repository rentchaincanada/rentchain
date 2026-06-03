import { Router } from "express";
import { db } from "../firebase";
import { requireAuth } from "../middleware/requireAuth";
import { requirePermission } from "../middleware/requireAuthz";
import { deriveEcosystemCoordinationSnapshot } from "../lib/ecosystemCoordination/deriveEcosystemCoordinationSnapshot";
import type { EcosystemCoordinationSnapshot, EcosystemCoordinationStatus } from "../lib/ecosystemCoordination/ecosystemCoordinationTypes";

const router = Router();

const COORDINATION_KEY = "institutional-ecosystem-coordination-v1";
const STATUSES = new Set<EcosystemCoordinationStatus>(["stable", "attention_required", "review_required", "blocked", "unknown"]);

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
    "participantId",
    "participantType",
    "trustRelationshipId",
    "relationshipType",
    "onboardingReadinessId",
    "institutionType",
    "operationalRiskId",
    "riskScope",
    "adapterReadinessId",
    "adapterType",
    "controlledIntegrationId",
    "integrationType",
    "settlementReadinessId",
    "regulatoryProfileId",
    "observabilityIncidentReadinessId",
    "releaseGovernanceId",
    "releaseVersion",
    "publicExposureHardeningId",
    "commercialReadinessId",
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

async function buildEcosystemCoordinationSnapshots(): Promise<EcosystemCoordinationSnapshot[]> {
  const [
    networkParticipants,
    trustRelationships,
    onboardingReadiness,
    operationalRiskProfiles,
    interoperabilityAdapterReadiness,
    controlledIntegrationProfiles,
    settlementReadiness,
    regulatoryProfiles,
    observabilityReadiness,
    releaseGovernanceProfiles,
    publicExposureHardeningProfiles,
    commercialReadinessProfiles,
    evidencePacks,
    reviews,
    auditEvents,
  ] = await Promise.all([
    loadCollection("networkParticipantProfiles"),
    loadCollection("crossOrganizationTrustRelationships"),
    loadCollection("institutionOnboardingReadiness"),
    loadCollection("operationalRiskProfiles"),
    loadCollection("interoperabilityAdapterReadiness"),
    loadCollection("controlledIntegrationProfiles"),
    loadCollection("settlementReadiness"),
    loadCollection("regulatoryProfiles"),
    loadCollection("observabilityIncidentReadinessProfiles"),
    loadCollection("releaseGovernanceProfiles"),
    loadCollection("publicExposureHardeningProfiles"),
    loadCollection("commercialReadinessProfiles"),
    loadCollection("evidencePacks"),
    loadCollection("operatorReviewSessions"),
    loadCollection("events"),
  ]);

  return [
    deriveEcosystemCoordinationSnapshot({
      coordinationKey: COORDINATION_KEY,
      networkParticipants,
      trustRelationships,
      onboardingReadiness,
      operationalRiskProfiles,
      interoperabilityAdapterReadiness,
      controlledIntegrationProfiles,
      settlementReadiness,
      regulatoryProfiles,
      observabilityReadiness,
      releaseGovernanceProfiles,
      publicExposureHardeningProfiles,
      commercialReadinessProfiles,
      evidencePacks,
      operatorReviewSessions: reviews,
      auditEvents,
    }),
  ];
}

function snapshotMatches(snapshot: EcosystemCoordinationSnapshot, id: string) {
  return snapshot.ecosystemCoordinationId === id;
}

router.get("/ecosystem-coordination", requireAuth, requirePermission("system.admin"), async (req: any, res) => {
  try {
    const status = asString(req.query?.status, 80) as EcosystemCoordinationStatus;
    let snapshots = await buildEcosystemCoordinationSnapshots();
    if (status && STATUSES.has(status)) snapshots = snapshots.filter((snapshot) => snapshot.status === status);
    return res.json({ ok: true, snapshots });
  } catch (err: any) {
    console.error("[admin-ecosystem-coordination] list failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "ECOSYSTEM_COORDINATION_FAILED" });
  }
});

router.get("/ecosystem-coordination/:ecosystemCoordinationId", requireAuth, requirePermission("system.admin"), async (req: any, res) => {
  try {
    const ecosystemCoordinationId = decodeURIComponent(asString(req.params?.ecosystemCoordinationId, 500));
    if (!ecosystemCoordinationId) return res.status(400).json({ ok: false, error: "ECOSYSTEM_COORDINATION_ID_REQUIRED" });
    const snapshots = await buildEcosystemCoordinationSnapshots();
    const snapshot = snapshots.find((next) => snapshotMatches(next, ecosystemCoordinationId));
    if (!snapshot) return res.status(404).json({ ok: false, error: "ECOSYSTEM_COORDINATION_NOT_FOUND" });
    return res.json({ ok: true, snapshot });
  } catch (err: any) {
    console.error("[admin-ecosystem-coordination] get failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "ECOSYSTEM_COORDINATION_GET_FAILED" });
  }
});

export default router;
