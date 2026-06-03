import { Router } from "express";
import { db } from "../firebase";
import { requireAuth } from "../middleware/requireAuth";
import { requirePermission } from "../middleware/requireAuthz";
import { deriveEnterpriseMunicipalReadinessProfile } from "../lib/enterpriseMunicipalReadiness/deriveEnterpriseMunicipalReadinessProfile";
import type {
  EnterpriseMunicipalOrganizationType,
  EnterpriseMunicipalReadinessProfile,
  EnterpriseMunicipalReadinessStatus,
} from "../lib/enterpriseMunicipalReadiness/enterpriseMunicipalReadinessTypes";

const router = Router();
const READINESS_KEY = "institutional-scale-enterprise-municipal-readiness-v1";

const ORGANIZATION_TYPES: EnterpriseMunicipalOrganizationType[] = [
  "municipality",
  "affordable_housing_operator",
  "institutional_landlord",
  "enterprise_operator",
  "government_program",
];
const STATUSES = new Set<EnterpriseMunicipalReadinessStatus>(["ready_for_review", "partially_ready", "review_required", "blocked", "unknown"]);

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
    "organizationType",
    "institutionType",
    "participantType",
    "integrationType",
    "onboardingReadinessId",
    "institutionOnboardingId",
    "commercialReadinessId",
    "platformCredentialingId",
    "portfolioGovernanceId",
    "portfolioId",
    "portfolioScoreId",
    "municipalReadinessId",
    "productionIntegrationId",
    "adapterReadinessId",
    "registryStatusId",
    "regulatoryProfileId",
    "operationalRiskId",
    "operationalRiskProfileId",
    "riskId",
    "reviewSessionId",
    "operatorReviewId",
    "evidencePackId",
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

function organizationTypeFromQuery(value: unknown): EnterpriseMunicipalOrganizationType | "" {
  const raw = asString(value, 80) as EnterpriseMunicipalOrganizationType;
  return ORGANIZATION_TYPES.includes(raw) ? raw : "";
}

function matchesOrganizationType(record: Record<string, any>, organizationType: EnterpriseMunicipalOrganizationType) {
  const type = asString(record.organizationType || record.institutionType || record.participantType, 80);
  if (!type) return true;
  if (organizationType === "municipality") return type === "municipality" || type === "registry";
  if (organizationType === "institutional_landlord") return type === "institutional_landlord" || type === "enterprise_operator";
  return type === organizationType;
}

async function buildEnterpriseMunicipalReadinessProfiles(organizationTypeFilter: EnterpriseMunicipalOrganizationType | ""): Promise<EnterpriseMunicipalReadinessProfile[]> {
  const [
    institutionOnboardingReadiness,
    commercialReadinessProfiles,
    platformCredentialingReadiness,
    portfolioGovernance,
    portfolioScores,
    productionIntegrations,
    interoperabilityReadiness,
    regulatoryProfiles,
    operationalRiskProfiles,
    reviews,
    evidencePacks,
    auditEvents,
  ] = await Promise.all([
    loadCollection("institutionOnboardingReadiness"),
    loadCollection("commercialReadinessProfiles"),
    loadCollection("platformCredentialingReadiness"),
    loadCollection("portfolioGovernanceReadiness"),
    loadCollection("portfolioScores"),
    loadCollection("productionIntegrationMetadata"),
    loadCollection("interoperabilityAdapterReadiness"),
    loadCollection("regulatoryProfiles"),
    loadCollection("operationalRiskProfiles"),
    loadCollection("operatorReviewSessions"),
    loadCollection("evidencePacks"),
    loadCollection("events"),
  ]);

  const types = organizationTypeFilter ? [organizationTypeFilter] : ORGANIZATION_TYPES;
  return types.map((organizationType) =>
    deriveEnterpriseMunicipalReadinessProfile({
      readinessKey: READINESS_KEY,
      organizationType,
      institutionalReadiness: [
        ...institutionOnboardingReadiness.filter((record) => matchesOrganizationType(record, organizationType)),
        ...commercialReadinessProfiles,
        ...platformCredentialingReadiness,
      ],
      portfolioGovernance: [...portfolioGovernance, ...portfolioScores],
      municipalReadiness: [
        ...productionIntegrations.filter((record) => matchesOrganizationType(record, organizationType)),
        ...interoperabilityReadiness.filter((record) => matchesOrganizationType(record, organizationType)),
      ],
      regulatoryProfiles,
      operationalRiskProfiles,
      operatorReviewSessions: reviews,
      evidencePacks,
      auditEvents,
    })
  );
}

function profileMatches(profile: EnterpriseMunicipalReadinessProfile, id: string) {
  return profile.enterpriseMunicipalReadinessId === id;
}

router.get("/enterprise-municipal-readiness", requireAuth, requirePermission("system.admin"), async (req: any, res) => {
  try {
    const organizationType = organizationTypeFromQuery(req.query?.organizationType);
    const status = asString(req.query?.status, 80) as EnterpriseMunicipalReadinessStatus;
    let profiles = await buildEnterpriseMunicipalReadinessProfiles(organizationType);
    if (status && STATUSES.has(status)) profiles = profiles.filter((profile) => profile.status === status);
    return res.json({ ok: true, profiles });
  } catch (err: any) {
    console.error("[admin-enterprise-municipal-readiness] list failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "ENTERPRISE_MUNICIPAL_READINESS_FAILED" });
  }
});

router.get("/enterprise-municipal-readiness/:enterpriseMunicipalReadinessId", requireAuth, requirePermission("system.admin"), async (req: any, res) => {
  try {
    const enterpriseMunicipalReadinessId = decodeURIComponent(asString(req.params?.enterpriseMunicipalReadinessId, 500));
    if (!enterpriseMunicipalReadinessId) return res.status(400).json({ ok: false, error: "ENTERPRISE_MUNICIPAL_READINESS_ID_REQUIRED" });
    const profiles = await buildEnterpriseMunicipalReadinessProfiles("");
    const profile = profiles.find((next) => profileMatches(next, enterpriseMunicipalReadinessId));
    if (!profile) return res.status(404).json({ ok: false, error: "ENTERPRISE_MUNICIPAL_READINESS_NOT_FOUND" });
    return res.json({ ok: true, profile });
  } catch (err: any) {
    console.error("[admin-enterprise-municipal-readiness] get failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "ENTERPRISE_MUNICIPAL_READINESS_GET_FAILED" });
  }
});

export default router;
