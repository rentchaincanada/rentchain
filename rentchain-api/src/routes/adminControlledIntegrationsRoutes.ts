import { Router } from "express";
import { db } from "../config/firebase";
import { requireAuth } from "../middleware/requireAuth";
import { requirePermission } from "../middleware/requireAuthz";
import { deriveControlledIntegrationProfile } from "../lib/controlledIntegrations/deriveControlledIntegrationProfile";
import type {
  ControlledIntegrationProfile,
  ControlledIntegrationStatus,
  ControlledIntegrationType,
} from "../lib/controlledIntegrations/controlledIntegrationTypes";

const router = Router();

const INTEGRATION_TYPES: ControlledIntegrationType[] = [
  "registry",
  "lender",
  "insurer",
  "regulator",
  "accounting",
  "payment_provider",
  "operational_partner",
];

const STATUSES = new Set<ControlledIntegrationStatus>(["disabled", "sandbox_ready", "review_required", "partially_ready", "blocked"]);

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
    "integrationType",
    "integrationKey",
    "adapterType",
    "adapterReadinessId",
    "adapterId",
    "reviewSessionId",
    "evidencePackId",
    "settlementReadinessId",
    "regulatoryProfileId",
    "observabilityIncidentReadinessId",
    "releaseGovernanceId",
    "releaseVersion",
    "operationalRiskId",
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

function integrationTypeFromQuery(value: unknown): ControlledIntegrationType | "" {
  const raw = asString(value, 80) as ControlledIntegrationType;
  return INTEGRATION_TYPES.includes(raw) ? raw : "";
}

function matchesIntegrationType(record: Record<string, any>, integrationType: ControlledIntegrationType) {
  const type = asString(record.integrationType || record.adapterType, 80);
  return !type || type === integrationType;
}

async function buildControlledIntegrationProfiles(integrationTypeFilter: ControlledIntegrationType | ""): Promise<ControlledIntegrationProfile[]> {
  const [
    activationMetadata,
    adapterReadiness,
    reviews,
    evidencePacks,
    settlementReadiness,
    regulatoryProfiles,
    observabilityIncidentReadiness,
    releaseGovernanceProfiles,
    operationalRiskProfiles,
    auditEvents,
  ] = await Promise.all([
    loadCollection("controlledIntegrationMetadata"),
    loadCollection("interoperabilityAdapterReadiness"),
    loadCollection("operatorReviewSessions"),
    loadCollection("evidencePacks"),
    loadCollection("settlementReadiness"),
    loadCollection("regulatoryProfiles"),
    loadCollection("observabilityIncidentReadinessProfiles"),
    loadCollection("releaseGovernanceProfiles"),
    loadCollection("operationalRiskProfiles"),
    loadCollection("events"),
  ]);

  const types = integrationTypeFilter ? [integrationTypeFilter] : INTEGRATION_TYPES;
  return types.map((integrationType) => {
    const metadata =
      activationMetadata.find((record) => asString(record.integrationType, 80) === integrationType) || {
        integrationKey: `${integrationType}-controlled-baseline`,
        integrationType,
        status: "disabled",
      };
    return deriveControlledIntegrationProfile({
      integrationKey: metadata.integrationKey || integrationType,
      integrationType,
      activationMetadata: metadata,
      adapterReadiness: adapterReadiness.filter((record) => matchesIntegrationType(record, integrationType)),
      operatorReviewSessions: reviews,
      evidencePacks,
      settlementReadiness,
      regulatoryProfiles,
      observabilityIncidentReadiness,
      releaseGovernanceProfiles,
      operationalRiskProfiles,
      auditEvents,
    });
  });
}

function profileMatches(profile: ControlledIntegrationProfile, id: string) {
  return profile.controlledIntegrationId === id;
}

router.get("/controlled-integrations", requireAuth, requirePermission("system.admin"), async (req: any, res) => {
  try {
    const integrationType = integrationTypeFromQuery(req.query?.integrationType);
    const status = asString(req.query?.status, 80) as ControlledIntegrationStatus;
    let profiles = await buildControlledIntegrationProfiles(integrationType);
    if (status && STATUSES.has(status)) profiles = profiles.filter((profile) => profile.status === status);
    return res.json({ ok: true, profiles });
  } catch (err: any) {
    console.error("[admin-controlled-integrations] list failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "CONTROLLED_INTEGRATIONS_FAILED" });
  }
});

router.get("/controlled-integrations/:controlledIntegrationId", requireAuth, requirePermission("system.admin"), async (req: any, res) => {
  try {
    const controlledIntegrationId = decodeURIComponent(asString(req.params?.controlledIntegrationId, 500));
    if (!controlledIntegrationId) return res.status(400).json({ ok: false, error: "CONTROLLED_INTEGRATION_ID_REQUIRED" });
    const profiles = await buildControlledIntegrationProfiles("");
    const profile = profiles.find((next) => profileMatches(next, controlledIntegrationId));
    if (!profile) return res.status(404).json({ ok: false, error: "CONTROLLED_INTEGRATION_NOT_FOUND" });
    return res.json({ ok: true, profile });
  } catch (err: any) {
    console.error("[admin-controlled-integrations] get failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "CONTROLLED_INTEGRATION_GET_FAILED" });
  }
});

export default router;
