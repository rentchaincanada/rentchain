import type {
  DeriveEnterpriseMunicipalReadinessProfileInput,
  EnterpriseMunicipalCanonicalEvent,
  EnterpriseMunicipalOrganizationType,
  EnterpriseMunicipalReadinessProfile,
  EnterpriseMunicipalReadinessStatus,
  EnterpriseMunicipalReference,
  EnterpriseMunicipalReferenceStatus,
  EnterpriseMunicipalReferenceType,
} from "./enterpriseMunicipalReadinessTypes";
import {
  enterpriseMunicipalIdPart,
  enterpriseMunicipalReference,
  enterpriseMunicipalRestriction,
} from "./enterpriseRestrictionModels";

const DEFAULT_KEY = "institutional-scale-enterprise-municipal-readiness-v1";
const ORGANIZATION_TYPES = new Set<EnterpriseMunicipalOrganizationType>([
  "municipality",
  "affordable_housing_operator",
  "institutional_landlord",
  "enterprise_operator",
  "government_program",
]);

const REDACTIONS = [
  "Sensitive tenant, screening, credit bureau, payment, banking, and private document payloads are excluded.",
  "Government integration payloads, CMHC submission payloads, unrestricted public-sector exports, and municipal system credentials are excluded.",
  "Enterprise and municipal readiness is visibility metadata only; no autonomous government or enterprise execution is enabled.",
  "Unrestricted portfolio exposure, hidden institutional orchestration, and admin-only operational payloads are excluded.",
];

function asString(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

function asArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function generatedAt(value: unknown): string {
  const raw = asString(value, 120);
  const date = raw ? new Date(raw) : new Date(0);
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
}

function normalizeOrganizationType(value: unknown): EnterpriseMunicipalOrganizationType {
  const raw = asString(value, 80) as EnterpriseMunicipalOrganizationType;
  return ORGANIZATION_TYPES.has(raw) ? raw : "enterprise_operator";
}

function recordId(record: Record<string, any>, keys: string[]): string {
  for (const key of keys) {
    const value = asString(record?.[key], 240);
    if (value) return value;
  }
  return asString(record?.id, 240);
}

function statusFromRecord(record: Record<string, any>, verifiedStatuses: string[]): EnterpriseMunicipalReferenceStatus {
  const status = asString(record?.status || record?.state || record?.conclusion || record?.severity, 80).toLowerCase();
  if (["blocked", "critical", "major", "failed", "failure", "error", "cancelled"].includes(status)) return "blocked";
  if (verifiedStatuses.includes(status)) return "verified";
  if (["missing", "unknown", "unavailable", "pending"].includes(status)) return "unavailable";
  return "partially_verified";
}

function profileStatus(hasContext: boolean, references: EnterpriseMunicipalReference[]): EnterpriseMunicipalReadinessStatus {
  if (!hasContext) return "unknown";
  if (references.some((reference) => reference.status === "blocked" && (reference.referenceType === "operational_risk" || reference.referenceType === "regulatory"))) return "blocked";
  const criticalMissing = references.some(
    (reference) =>
      reference.status === "unavailable" &&
      (reference.referenceType === "institutional" ||
        reference.referenceType === "municipal" ||
        reference.referenceType === "regulatory" ||
        reference.referenceType === "review" ||
        reference.referenceType === "evidence")
  );
  if (criticalMissing) return "review_required";
  if (references.some((reference) => reference.status === "blocked" || reference.status === "unavailable" || reference.status === "partially_verified")) return "partially_ready";
  return "ready_for_review";
}

function event(input: {
  eventType: EnterpriseMunicipalCanonicalEvent["eventType"];
  status: EnterpriseMunicipalReadinessStatus;
  enterpriseMunicipalReadinessId: string;
  summary: string;
}): EnterpriseMunicipalCanonicalEvent {
  return {
    eventType: input.eventType,
    action: input.eventType.replace(/^enterprise_municipal_/, "").replace(/_/g, "."),
    status: input.status,
    resourceType: "enterprise_municipal_readiness_profile",
    resourceId: input.enterpriseMunicipalReadinessId,
    summary: input.summary,
  };
}

function statusForType(referenceType: EnterpriseMunicipalReferenceType, record: Record<string, any>): EnterpriseMunicipalReferenceStatus {
  if (referenceType === "audit" && asString(record?.eventType || record?.type, 120)) return record.redacted ? "partially_verified" : "verified";
  if (referenceType === "institutional") return statusFromRecord(record, ["ready_for_review", "verified", "active", "stable"]);
  if (referenceType === "municipal") return statusFromRecord(record, ["ready_for_review", "verified", "ready", "matched"]);
  if (referenceType === "portfolio_governance") return statusFromRecord(record, ["ready_for_review", "verified", "healthy", "stable", "available"]);
  if (referenceType === "regulatory") return statusFromRecord(record, ["ready_for_review", "verified"]);
  if (referenceType === "operational_risk") return statusFromRecord(record, ["stable", "verified", "accepted", "resolved"]);
  if (referenceType === "review") return statusFromRecord(record, ["ready_for_review", "completed", "verified", "reviewed"]);
  return statusFromRecord(record, ["ready_for_review", "verified", "available", "completed", "stable"]);
}

function referencesFor(input: {
  records: Record<string, any>[];
  fallback: string;
  referenceType: EnterpriseMunicipalReferenceType;
  idKeys: string[];
  label: string;
  description: string;
  destination: string;
  blockedReason: string;
}): EnterpriseMunicipalReference[] {
  if (!input.records.length) {
    return [
      enterpriseMunicipalReference({
        idParts: [input.referenceType, "missing"],
        referenceType: input.referenceType,
        status: "unavailable",
        label: input.label,
        description: `${input.description} is unavailable for enterprise and municipal readiness review.`,
        destination: input.destination,
      }),
    ];
  }
  return input.records.map((record, index) => {
    const id = recordId(record, input.idKeys) || `${input.fallback}-${index + 1}`;
    const status = statusForType(input.referenceType, record);
    return enterpriseMunicipalReference({
      idParts: [input.referenceType, id],
      referenceType: input.referenceType,
      status,
      label: input.label,
      description: `${input.description} is available as institutional readiness metadata.`,
      lineageReferences: [id].filter(Boolean),
      destination: input.destination,
      redacted: Boolean(record.redacted),
      redactionReason: record.redacted ? `${input.label} payload is redacted for enterprise and municipal readiness safety.` : null,
      blockedReason: status === "blocked" ? input.blockedReason : null,
    });
  });
}

export function deriveEnterpriseMunicipalReadinessProfile(input: DeriveEnterpriseMunicipalReadinessProfileInput): EnterpriseMunicipalReadinessProfile {
  const organizationType = normalizeOrganizationType(input.organizationType);
  const readinessKey = asString(input.readinessKey, 160) || DEFAULT_KEY;
  const enterpriseMunicipalReadinessId =
    enterpriseMunicipalIdPart(["enterprise_municipal_readiness", readinessKey, organizationType].join(":")) ||
    "enterprise_municipal_readiness:unknown";

  const institutionalReadiness = asArray(input.institutionalReadiness);
  const portfolioGovernance = asArray(input.portfolioGovernance);
  const municipalReadiness = asArray(input.municipalReadiness);
  const regulatoryProfiles = asArray(input.regulatoryProfiles);
  const operationalRiskProfiles = asArray(input.operationalRiskProfiles);
  const reviews = asArray(input.operatorReviewSessions);
  const evidencePacks = asArray(input.evidencePacks);
  const auditEvents = asArray(input.auditEvents);

  const institutionalReferences = referencesFor({
    records: institutionalReadiness,
    fallback: "institutional",
    referenceType: "institutional",
    idKeys: ["onboardingReadinessId", "institutionOnboardingId", "commercialReadinessId", "platformCredentialingId", "id"],
    label: "Institutional readiness reference",
    description: "Enterprise onboarding, credentialing, and institutional governance readiness",
    destination: "/institution-onboarding-readiness",
    blockedReason: "Institutional readiness is blocked.",
  });
  const portfolioGovernanceReferences = referencesFor({
    records: portfolioGovernance,
    fallback: "portfolio-governance",
    referenceType: "portfolio_governance",
    idKeys: ["portfolioGovernanceId", "portfolioId", "portfolioScoreId", "id"],
    label: "Portfolio governance reference",
    description: "Portfolio governance and operational-scale readiness",
    destination: "/portfolio-health",
    blockedReason: "Portfolio governance readiness is blocked.",
  });
  const municipalReadinessReferences = referencesFor({
    records: municipalReadiness,
    fallback: "municipal",
    referenceType: "municipal",
    idKeys: ["municipalReadinessId", "productionIntegrationId", "adapterReadinessId", "registryStatusId", "id"],
    label: "Municipal readiness reference",
    description: "Municipal, registry, affordable-housing, and public-sector preparedness",
    destination: "/admin/production-integrations",
    blockedReason: "Municipal readiness lineage is blocked.",
  });
  const regulatoryReferences = referencesFor({
    records: regulatoryProfiles,
    fallback: "regulatory",
    referenceType: "regulatory",
    idKeys: ["regulatoryProfileId", "id"],
    label: "Regulatory readiness reference",
    description: "Regulatory and governance dependency readiness",
    destination: "/regulatory-profiles",
    blockedReason: "Regulatory readiness blocks enterprise and municipal readiness.",
  });
  const operationalRiskReferences = referencesFor({
    records: operationalRiskProfiles,
    fallback: "operational-risk",
    referenceType: "operational_risk",
    idKeys: ["operationalRiskId", "operationalRiskProfileId", "riskId", "id"],
    label: "Operational risk reference",
    description: "Operational-risk dependency readiness",
    destination: "/operational-risk",
    blockedReason: "Unresolved operational risk blocks enterprise and municipal readiness.",
  });
  const reviewReferences = referencesFor({
    records: reviews,
    fallback: "review",
    referenceType: "review",
    idKeys: ["reviewSessionId", "operatorReviewId", "id"],
    label: "Institutional review lineage reference",
    description: "Manual review lineage",
    destination: "/review-timeline",
    blockedReason: "Institutional review lineage is blocked.",
  });
  const evidenceReferences = referencesFor({
    records: evidencePacks,
    fallback: "evidence",
    referenceType: "evidence",
    idKeys: ["evidencePackId", "id"],
    label: "Institutional evidence lineage reference",
    description: "Evidence lineage",
    destination: "/evidence-packs",
    blockedReason: "Institutional evidence lineage is blocked.",
  });
  const auditReferences = referencesFor({
    records: auditEvents.slice(0, 20),
    fallback: "audit",
    referenceType: "audit",
    idKeys: ["eventId", "auditId", "id"],
    label: "Institutional audit lineage reference",
    description: "Audit lineage",
    destination: "/review-timeline",
    blockedReason: "Institutional audit lineage is blocked.",
  });

  const allReferences = [
    ...institutionalReferences,
    ...portfolioGovernanceReferences,
    ...municipalReadinessReferences,
    ...regulatoryReferences,
    ...operationalRiskReferences,
    ...reviewReferences,
    ...evidenceReferences,
    ...auditReferences,
  ];
  const hasContext = Boolean(
    institutionalReadiness.length ||
      portfolioGovernance.length ||
      municipalReadiness.length ||
      regulatoryProfiles.length ||
      operationalRiskProfiles.length ||
      reviews.length ||
      evidencePacks.length ||
      auditEvents.length
  );
  const status = profileStatus(hasContext, allReferences);
  const enterpriseRestrictions = allReferences
    .filter((reference) => reference.status !== "verified")
    .map((reference) =>
      enterpriseMunicipalRestriction({
        idParts: [reference.referenceType, reference.referenceId],
        restrictionType: reference.referenceType,
        status: reference.status === "blocked" ? "blocked" : "review_required",
        label: `${reference.label} restriction`,
        description: `${reference.label} is incomplete or blocked for enterprise and municipal readiness review.`,
        blockedReason: reference.blockedReason,
      })
    );
  const blockedReasons = [...allReferences.map((reference) => reference.blockedReason), ...enterpriseRestrictions.map((restriction) => restriction.blockedReason)].filter(Boolean) as string[];

  const canonicalEvents: EnterpriseMunicipalCanonicalEvent[] = [
    event({
      eventType: "enterprise_municipal_readiness_profile_derived",
      status,
      enterpriseMunicipalReadinessId,
      summary: "Enterprise municipal readiness profile derived from institutional, municipal, portfolio, regulatory, risk, review, evidence, and audit metadata.",
    }),
    event({
      eventType: "enterprise_municipal_redaction_applied",
      status,
      enterpriseMunicipalReadinessId,
      summary: "Sensitive tenant, screening, payment, banking, public-sector, CMHC submission, portfolio, and admin-only payloads were excluded.",
    }),
  ];
  if (enterpriseRestrictions.length) {
    canonicalEvents.push(event({ eventType: "enterprise_municipal_restriction_detected", status, enterpriseMunicipalReadinessId, summary: "Enterprise municipal restrictions are visible for manual review." }));
  }
  if (status === "review_required" || status === "partially_ready") {
    canonicalEvents.push(event({ eventType: "enterprise_municipal_review_required", status, enterpriseMunicipalReadinessId, summary: "Manual enterprise municipal review is required." }));
  }
  if (status === "blocked") {
    canonicalEvents.push(event({ eventType: "enterprise_municipal_blocked", status, enterpriseMunicipalReadinessId, summary: "Enterprise municipal readiness is blocked by unresolved restrictions." }));
  }

  return {
    enterpriseMunicipalReadinessId,
    organizationType,
    status,
    manualApprovalRequired: true,
    autonomousGovernmentExecutionEnabled: false,
    autonomousEnterpriseExecutionEnabled: false,
    generatedAt: generatedAt(input.generatedAt),
    summary: {
      totalReferences: allReferences.length,
      verifiedReferences: allReferences.filter((reference) => reference.status === "verified").length,
      partiallyVerifiedReferences: allReferences.filter((reference) => reference.status === "partially_verified").length,
      blockedReferences: allReferences.filter((reference) => reference.status === "blocked").length,
      unavailableReferences: allReferences.filter((reference) => reference.status === "unavailable").length,
      restrictions: enterpriseRestrictions.length,
    },
    institutionalReferences,
    portfolioGovernanceReferences,
    municipalReadinessReferences,
    regulatoryReferences,
    operationalRiskReferences,
    reviewReferences,
    evidenceReferences,
    auditReferences,
    enterpriseRestrictions,
    redactions: REDACTIONS,
    blockedReasons,
    canonicalEvents,
  };
}
