import { Router } from "express";
import { db } from "../firebase";
import { requireAuth } from "../middleware/requireAuth";
import { requirePermission } from "../middleware/requireAuthz";
import { deriveProductionIntegrationProfile } from "../lib/productionIntegrations/deriveProductionIntegrationProfile";
import type {
  ProductionIntegrationProfile,
  ProductionIntegrationStatus,
  ProductionIntegrationType,
} from "../lib/productionIntegrations/productionIntegrationTypes";

const router = Router();

const INTEGRATION_TYPES: ProductionIntegrationType[] = [
  "registry",
  "accounting_export",
  "screening_provider",
  "lender_handoff",
  "webhook_ingestion",
  "operational_partner",
];

const STATUSES = new Set<ProductionIntegrationStatus>(["disabled", "sandbox_ready", "production_review_required", "partially_ready", "blocked"]);

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
    "integrationType",
    "integrationKey",
    "productionIntegrationId",
    "controlledIntegrationId",
    "adapterType",
    "adapterReadinessId",
    "adapterId",
    "observabilityIncidentReadinessId",
    "incidentId",
    "alertId",
    "releaseGovernanceId",
    "releaseVersion",
    "supportOperationsId",
    "reviewSessionId",
    "operatorReviewId",
    "evidencePackId",
    "operationalRiskId",
    "riskId",
    "regulatoryProfileId",
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

async function loadCollection(collectionName: string, limit = 30) {
  const snap = await db.collection(collectionName).get().catch(() => null);
  return (snap?.docs || []).slice(0, limit).map((doc) => sanitizeRecord({ id: doc.id, ...((doc.data() as any) || {}) }));
}

function integrationTypeFromQuery(value: unknown): ProductionIntegrationType | "" {
  const raw = asString(value, 80) as ProductionIntegrationType;
  return INTEGRATION_TYPES.includes(raw) ? raw : "";
}

function legacyAdapterTypes(integrationType: ProductionIntegrationType) {
  if (integrationType === "accounting_export") return ["accounting", "accounting_export"];
  if (integrationType === "screening_provider") return ["screening_provider"];
  if (integrationType === "lender_handoff") return ["lender", "lender_handoff"];
  if (integrationType === "webhook_ingestion") return ["webhook_ingestion"];
  return [integrationType];
}

function matchesIntegrationType(record: Record<string, any>, integrationType: ProductionIntegrationType) {
  const type = asString(record.integrationType || record.adapterType, 80);
  return !type || legacyAdapterTypes(integrationType).includes(type);
}

async function buildProductionIntegrationProfiles(integrationTypeFilter: ProductionIntegrationType | ""): Promise<ProductionIntegrationProfile[]> {
  const [
    productionMetadata,
    controlledMetadata,
    adapterReadiness,
    controlledIntegrationProfiles,
    observabilityIncidentReadiness,
    releaseGovernanceProfiles,
    supportOperationsProfiles,
    reviews,
    evidencePacks,
    operationalRiskProfiles,
    regulatoryProfiles,
    auditEvents,
  ] = await Promise.all([
    loadCollection("productionIntegrationMetadata"),
    loadCollection("controlledIntegrationMetadata"),
    loadCollection("interoperabilityAdapterReadiness"),
    loadCollection("controlledIntegrationProfiles"),
    loadCollection("observabilityIncidentReadinessProfiles"),
    loadCollection("releaseGovernanceProfiles"),
    loadCollection("supportOperationsProfiles"),
    loadCollection("operatorReviewSessions"),
    loadCollection("evidencePacks"),
    loadCollection("operationalRiskProfiles"),
    loadCollection("regulatoryProfiles"),
    loadCollection("events"),
  ]);

  const types = integrationTypeFilter ? [integrationTypeFilter] : INTEGRATION_TYPES;
  return types.map((integrationType) => {
    const metadata =
      productionMetadata.find((record) => matchesIntegrationType(record, integrationType)) ||
      controlledMetadata.find((record) => matchesIntegrationType(record, integrationType)) || {
        integrationKey: `${integrationType}-production-baseline`,
        integrationType,
        status: "disabled",
      };
    return deriveProductionIntegrationProfile({
      integrationKey: metadata.integrationKey || integrationType,
      integrationType,
      activationMetadata: metadata,
      adapterReadiness: adapterReadiness.filter((record) => matchesIntegrationType(record, integrationType)),
      controlledIntegrationProfiles: controlledIntegrationProfiles.filter((record) => matchesIntegrationType(record, integrationType)),
      observabilityIncidentReadiness,
      releaseGovernanceProfiles,
      supportOperationsProfiles,
      operatorReviewSessions: reviews,
      evidencePacks,
      operationalRiskProfiles,
      regulatoryProfiles,
      auditEvents,
    });
  });
}

function profileMatches(profile: ProductionIntegrationProfile, id: string) {
  return profile.productionIntegrationId === id;
}

router.get("/production-integrations", requireAuth, requirePermission("system.admin"), async (req: any, res) => {
  try {
    const integrationType = integrationTypeFromQuery(req.query?.integrationType);
    const status = asString(req.query?.status, 80) as ProductionIntegrationStatus;
    let profiles = await buildProductionIntegrationProfiles(integrationType);
    if (status && STATUSES.has(status)) profiles = profiles.filter((profile) => profile.status === status);
    return res.json({ ok: true, profiles });
  } catch (err: any) {
    console.error("[admin-production-integrations] list failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "PRODUCTION_INTEGRATIONS_FAILED" });
  }
});

router.get("/production-integrations/:productionIntegrationId", requireAuth, requirePermission("system.admin"), async (req: any, res) => {
  try {
    const productionIntegrationId = decodeURIComponent(asString(req.params?.productionIntegrationId, 500));
    if (!productionIntegrationId) return res.status(400).json({ ok: false, error: "PRODUCTION_INTEGRATION_ID_REQUIRED" });
    const profiles = await buildProductionIntegrationProfiles("");
    const profile = profiles.find((next) => profileMatches(next, productionIntegrationId));
    if (!profile) return res.status(404).json({ ok: false, error: "PRODUCTION_INTEGRATION_NOT_FOUND" });
    return res.json({ ok: true, profile });
  } catch (err: any) {
    console.error("[admin-production-integrations] get failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "PRODUCTION_INTEGRATION_GET_FAILED" });
  }
});

export default router;
