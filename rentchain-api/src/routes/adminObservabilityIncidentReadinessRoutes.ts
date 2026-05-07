import { Router } from "express";
import { db } from "../config/firebase";
import { requireAuth } from "../middleware/requireAuth";
import { requirePermission } from "../middleware/requireAuthz";
import { deriveObservabilityIncidentReadinessProfile } from "../lib/observabilityIncidentReadiness/deriveObservabilityIncidentReadinessProfile";
import type {
  ObservabilityIncidentReadinessProfile,
  ObservabilityIncidentReadinessStatus,
} from "../lib/observabilityIncidentReadiness/observabilityIncidentReadinessTypes";
import { SYSTEM_OBSERVABILITY_EVENTS_COLLECTION } from "../services/observability/observabilityTypes";

const router = Router();

const READINESS_KEY = "operational-observability-incident-readiness-v1";
const STATUSES = new Set<ObservabilityIncidentReadinessStatus>([
  "ready_for_review",
  "partially_ready",
  "review_required",
  "blocked",
  "unknown",
]);

const RECOVERY_READINESS = [
  { recoveryReadinessId: "manual-recovery-readiness-baseline", status: "ready_for_review" },
];

const ESCALATION_READINESS = [
  { escalationReadinessId: "manual-escalation-readiness-baseline", status: "ready_for_review" },
];

const POST_INCIDENT_REVIEWS = [
  { postIncidentReviewId: "manual-post-incident-review-baseline", status: "ready_for_review" },
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
    "observabilityEventId",
    "workflow",
    "severity",
    "title",
    "occurredAt",
    "resolvedAt",
    "incidentId",
    "createdAt",
    "updatedAt",
    "resolvedAtMs",
    "recoveryReadinessId",
    "recoveryId",
    "escalationReadinessId",
    "escalationId",
    "postIncidentReviewId",
    "reviewId",
    "slaId",
    "stage",
    "resourceId",
    "alertId",
    "releaseGovernanceId",
    "releaseVersion",
    "publicExposureHardeningId",
    "evidencePackId",
    "reviewSessionId",
    "resourceType",
    "resourceId",
    "redacted",
  ]) {
    if (record[key] !== undefined) safe[key] = record[key];
  }
  if (record.sla && typeof record.sla === "object") {
    safe.sla = { stage: asString(record.sla.stage, 80) || null };
  }
  return safe;
}

async function buildObservabilityIncidentReadinessProfiles(): Promise<ObservabilityIncidentReadinessProfile[]> {
  const [
    observabilityEvents,
    statusIncidents,
    recoveryReadiness,
    escalationReadiness,
    postIncidentReviews,
    slaEvaluations,
    adminAlerts,
    releaseGovernanceProfiles,
    publicExposureHardeningProfiles,
    evidencePacks,
    reviews,
    auditEvents,
  ] = await Promise.all([
    loadCollection(SYSTEM_OBSERVABILITY_EVENTS_COLLECTION),
    loadCollection("statusIncidents"),
    loadCollection("incidentRecoveryReadiness"),
    loadCollection("incidentEscalationReadiness"),
    loadCollection("postIncidentReviews"),
    loadCollection("slaEvaluations"),
    loadCollection("adminAlerts"),
    loadCollection("releaseGovernanceProfiles"),
    loadCollection("publicExposureHardeningProfiles"),
    loadCollection("evidencePacks"),
    loadCollection("operatorReviewSessions"),
    loadCollection("events"),
  ]);

  return [
    deriveObservabilityIncidentReadinessProfile({
      readinessKey: READINESS_KEY,
      observabilityEvents,
      statusIncidents,
      recoveryReadiness: recoveryReadiness.length ? recoveryReadiness : RECOVERY_READINESS,
      escalationReadiness: escalationReadiness.length ? escalationReadiness : ESCALATION_READINESS,
      postIncidentReviews: postIncidentReviews.length ? postIncidentReviews : POST_INCIDENT_REVIEWS,
      slaEvaluations,
      adminAlerts,
      releaseGovernanceProfiles,
      publicExposureHardeningProfiles,
      evidencePacks,
      operatorReviewSessions: reviews,
      auditEvents,
    }),
  ];
}

function profileMatches(profile: ObservabilityIncidentReadinessProfile, id: string) {
  return profile.observabilityIncidentReadinessId === id;
}

router.get("/observability-incident-readiness", requireAuth, requirePermission("system.admin"), async (req: any, res) => {
  try {
    const status = asString(req.query?.status, 80) as ObservabilityIncidentReadinessStatus;
    let profiles = await buildObservabilityIncidentReadinessProfiles();
    if (status && STATUSES.has(status)) profiles = profiles.filter((profile) => profile.status === status);
    return res.json({ ok: true, profiles });
  } catch (err: any) {
    console.error("[admin-observability-incident-readiness] list failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "OBSERVABILITY_INCIDENT_READINESS_FAILED" });
  }
});

router.get(
  "/observability-incident-readiness/:observabilityIncidentReadinessId",
  requireAuth,
  requirePermission("system.admin"),
  async (req: any, res) => {
    try {
      const observabilityIncidentReadinessId = decodeURIComponent(asString(req.params?.observabilityIncidentReadinessId, 500));
      if (!observabilityIncidentReadinessId) return res.status(400).json({ ok: false, error: "OBSERVABILITY_INCIDENT_READINESS_ID_REQUIRED" });
      const profiles = await buildObservabilityIncidentReadinessProfiles();
      const profile = profiles.find((next) => profileMatches(next, observabilityIncidentReadinessId));
      if (!profile) return res.status(404).json({ ok: false, error: "OBSERVABILITY_INCIDENT_READINESS_NOT_FOUND" });
      return res.json({ ok: true, profile });
    } catch (err: any) {
      console.error("[admin-observability-incident-readiness] get failed", err?.message || err);
      return res.status(500).json({ ok: false, error: "OBSERVABILITY_INCIDENT_READINESS_GET_FAILED" });
    }
  }
);

export default router;
