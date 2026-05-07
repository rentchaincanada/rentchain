import type {
  DeriveProductionIntegrationProfileInput,
  ProductionIntegrationCanonicalEvent,
  ProductionIntegrationProfile,
  ProductionIntegrationReference,
  ProductionIntegrationReferenceStatus,
  ProductionIntegrationReferenceType,
  ProductionIntegrationStatus,
  ProductionIntegrationType,
} from "./productionIntegrationTypes";
import {
  productionIntegrationIdPart,
  productionIntegrationReference,
  productionIntegrationRestriction,
} from "./integrationRestrictionModels";

const INTEGRATION_TYPES = new Set<ProductionIntegrationType>([
  "registry",
  "accounting_export",
  "screening_provider",
  "lender_handoff",
  "webhook_ingestion",
  "operational_partner",
]);

const REDACTIONS = [
  "Provider credentials, webhook secrets, API tokens, integration execution payloads, and external mutation payloads are excluded.",
  "Sensitive tenant, screening, banking, payment, settlement, and private document payloads are excluded.",
  "Production integrations are supervised readiness metadata only; no autonomous synchronization or unrestricted external execution is enabled.",
  "Raw provider webhooks, unrestricted telemetry, unrestricted provider payloads, and payment or settlement execution payloads are excluded.",
];

function asString(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

function asArray(value: Array<Record<string, any>> | Record<string, any> | null | undefined): Array<Record<string, any>> {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function generatedAt(value: unknown): string {
  const raw = asString(value, 120);
  const date = raw ? new Date(raw) : new Date(0);
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
}

function normalizeIntegrationType(value: unknown): ProductionIntegrationType {
  const raw = asString(value, 80) as ProductionIntegrationType;
  return INTEGRATION_TYPES.has(raw) ? raw : "operational_partner";
}

function recordId(record: Record<string, any>, keys: string[]): string {
  for (const key of keys) {
    const value = asString(record?.[key], 240);
    if (value) return value;
  }
  return asString(record?.id, 240);
}

function referenceStatus(record: Record<string, any>, verifiedStatuses: string[]): ProductionIntegrationReferenceStatus {
  const status = asString(record?.status || record?.state || record?.conclusion || record?.severity, 80).toLowerCase();
  if (["blocked", "critical", "major", "failed", "failure", "error", "cancelled"].includes(status)) return "blocked";
  if (verifiedStatuses.includes(status)) return "verified";
  if (["missing", "unknown", "unavailable", "pending"].includes(status)) return "unavailable";
  return "partially_verified";
}

function statusForType(referenceType: ProductionIntegrationReferenceType, record: Record<string, any>): ProductionIntegrationReferenceStatus {
  if (referenceType === "audit" && asString(record?.eventType || record?.type, 120)) return record.redacted ? "partially_verified" : "verified";
  if (referenceType === "activation") return referenceStatus(record, ["sandbox_ready", "ready_for_review", "verified", "enabled", "active"]);
  if (referenceType === "observability") return referenceStatus(record, ["ready_for_review", "verified", "stable", "resolved"]);
  if (referenceType === "rollback") return referenceStatus(record, ["ready_for_review", "verified", "stable", "available"]);
  if (referenceType === "governance") return referenceStatus(record, ["sandbox_ready", "ready_for_review", "verified", "stable"]);
  if (referenceType === "review") return referenceStatus(record, ["ready_for_review", "completed", "verified", "reviewed"]);
  return referenceStatus(record, ["ready_for_review", "verified", "available", "completed", "stable", "active"]);
}

function isDisabled(records: Record<string, any>[]): boolean {
  if (!records.length) return true;
  return records.every((record) => {
    const status = asString(record?.status || record?.state, 80).toLowerCase();
    return status === "disabled" || status === "inactive" || status === "off";
  });
}

function profileStatus(input: {
  disabled: boolean;
  references: ProductionIntegrationReference[];
  operationalRiskProfiles: Record<string, any>[];
  regulatoryProfiles: Record<string, any>[];
}): ProductionIntegrationStatus {
  if (input.disabled) return "disabled";
  const blockedRisk = input.operationalRiskProfiles.some((profile) => referenceStatus(profile, ["stable", "verified", "accepted", "resolved"]) === "blocked");
  const blockedRegulatory = input.regulatoryProfiles.some((profile) => referenceStatus(profile, ["ready_for_review", "verified"]) === "blocked");
  if (blockedRisk || blockedRegulatory || input.references.some((reference) => reference.status === "blocked")) return "blocked";
  const criticalMissing = input.references.some(
    (reference) =>
      reference.status === "unavailable" &&
      (reference.referenceType === "activation" ||
        reference.referenceType === "observability" ||
        reference.referenceType === "governance" ||
        reference.referenceType === "review" ||
        reference.referenceType === "evidence")
  );
  if (criticalMissing) return "production_review_required";
  if (input.references.some((reference) => reference.status === "unavailable" || reference.status === "partially_verified")) return "partially_ready";
  return "sandbox_ready";
}

function event(input: {
  eventType: ProductionIntegrationCanonicalEvent["eventType"];
  status: ProductionIntegrationStatus;
  productionIntegrationId: string;
  summary: string;
}): ProductionIntegrationCanonicalEvent {
  return {
    eventType: input.eventType,
    action: input.eventType.replace(/^production_integration_/, "").replace(/_/g, "."),
    status: input.status,
    resourceType: "production_integration_profile",
    resourceId: input.productionIntegrationId,
    summary: input.summary,
  };
}

function referencesFor(input: {
  records: Record<string, any>[];
  fallback: string;
  referenceType: ProductionIntegrationReferenceType;
  idKeys: string[];
  label: string;
  description: string;
  destination: string;
  blockedReason: string;
}): ProductionIntegrationReference[] {
  if (!input.records.length) {
    return [
      productionIntegrationReference({
        idParts: [input.referenceType, "missing"],
        referenceType: input.referenceType,
        status: "unavailable",
        label: input.label,
        description: `${input.description} is unavailable for production integration review.`,
        destination: input.destination,
      }),
    ];
  }
  return input.records.map((record, index) => {
    const id = recordId(record, input.idKeys) || `${input.fallback}-${index + 1}`;
    const status = statusForType(input.referenceType, record);
    return productionIntegrationReference({
      idParts: [input.referenceType, id],
      referenceType: input.referenceType,
      status,
      label: input.label,
      description: `${input.description} is available as supervised production integration metadata.`,
      lineageReferences: [id].filter(Boolean),
      destination: input.destination,
      redacted: Boolean(record.redacted),
      redactionReason: record.redacted ? `${input.label} payload is redacted for production integration safety.` : null,
      blockedReason: status === "blocked" ? input.blockedReason : null,
    });
  });
}

export function deriveProductionIntegrationProfile(input: DeriveProductionIntegrationProfileInput): ProductionIntegrationProfile {
  const integrationType = normalizeIntegrationType(input.integrationType);
  const integrationKey = asString(input.integrationKey, 160) || integrationType;
  const productionIntegrationId =
    productionIntegrationIdPart(["production_integration", integrationKey, integrationType].join(":")) ||
    "production_integration:unknown";

  const activationMetadata = asArray(input.activationMetadata);
  const adapterReadiness = asArray(input.adapterReadiness);
  const controlledIntegrationProfiles = asArray(input.controlledIntegrationProfiles);
  const observabilityIncidentReadiness = asArray(input.observabilityIncidentReadiness);
  const releaseGovernanceProfiles = asArray(input.releaseGovernanceProfiles);
  const supportOperationsProfiles = asArray(input.supportOperationsProfiles);
  const operatorReviewSessions = asArray(input.operatorReviewSessions);
  const evidencePacks = asArray(input.evidencePacks);
  const operationalRiskProfiles = asArray(input.operationalRiskProfiles);
  const regulatoryProfiles = asArray(input.regulatoryProfiles);
  const auditEvents = asArray(input.auditEvents);

  const activationReferences = referencesFor({
    records: [...activationMetadata, ...adapterReadiness],
    fallback: "activation",
    referenceType: "activation",
    idKeys: ["productionIntegrationId", "integrationKey", "adapterReadinessId", "adapterId", "id"],
    label: "Production activation readiness reference",
    description: "Production activation and sandbox-to-production transition lineage",
    destination: "/admin/production-integrations",
    blockedReason: "Production activation readiness is blocked.",
  });
  const observabilityReferences = referencesFor({
    records: observabilityIncidentReadiness,
    fallback: "observability",
    referenceType: "observability",
    idKeys: ["observabilityIncidentReadinessId", "incidentId", "alertId", "id"],
    label: "Integration observability reference",
    description: "Observability and incident readiness linkage",
    destination: "/admin/observability-incident-readiness",
    blockedReason: "Observability readiness blocks production integration review.",
  });
  const rollbackReferences = referencesFor({
    records: [...releaseGovernanceProfiles, ...supportOperationsProfiles],
    fallback: "rollback",
    referenceType: "rollback",
    idKeys: ["releaseGovernanceId", "supportOperationsId", "releaseVersion", "id"],
    label: "Integration rollback readiness reference",
    description: "Rollback readiness and operational recovery lineage",
    destination: "/admin/release-governance",
    blockedReason: "Rollback readiness blocks production integration review.",
  });
  const reviewReferences = referencesFor({
    records: operatorReviewSessions,
    fallback: "review",
    referenceType: "review",
    idKeys: ["reviewSessionId", "operatorReviewId", "id"],
    label: "Production integration review lineage reference",
    description: "Manual review lineage",
    destination: "/review-timeline",
    blockedReason: "Production integration review lineage is blocked.",
  });
  const evidenceReferences = referencesFor({
    records: evidencePacks,
    fallback: "evidence",
    referenceType: "evidence",
    idKeys: ["evidencePackId", "id"],
    label: "Production integration evidence lineage reference",
    description: "Evidence lineage",
    destination: "/evidence-packs",
    blockedReason: "Production integration evidence lineage is blocked.",
  });
  const governanceReferences = referencesFor({
    records: [...controlledIntegrationProfiles, ...releaseGovernanceProfiles],
    fallback: "governance",
    referenceType: "governance",
    idKeys: ["controlledIntegrationId", "releaseGovernanceId", "releaseVersion", "id"],
    label: "Production integration governance reference",
    description: "Controlled integration and release governance lineage",
    destination: "/admin/controlled-integrations",
    blockedReason: "Production integration governance is blocked.",
  });
  const auditReferences = referencesFor({
    records: auditEvents.slice(0, 20),
    fallback: "audit",
    referenceType: "audit",
    idKeys: ["eventId", "auditId", "id"],
    label: "Production integration audit lineage reference",
    description: "Audit lineage",
    destination: "/review-timeline",
    blockedReason: "Production integration audit lineage is blocked.",
  });

  const allReferences = [
    ...activationReferences,
    ...observabilityReferences,
    ...rollbackReferences,
    ...reviewReferences,
    ...evidenceReferences,
    ...governanceReferences,
    ...auditReferences,
  ];
  const disabled = isDisabled(activationMetadata);
  const status = profileStatus({ disabled, references: allReferences, operationalRiskProfiles, regulatoryProfiles });
  const integrationRestrictions = [
    ...allReferences
      .filter((reference) => reference.status !== "verified")
      .map((reference) =>
        productionIntegrationRestriction({
          idParts: [reference.referenceType, reference.referenceId],
          restrictionType: reference.referenceType,
          status: reference.status === "blocked" ? "blocked" : "review_required",
          label: `${reference.label} restriction`,
          description: `${reference.label} is incomplete or blocked for production integration readiness.`,
          blockedReason: reference.blockedReason,
        })
      ),
    ...operationalRiskProfiles
      .filter((profile) => referenceStatus(profile, ["stable", "verified", "accepted", "resolved"]) === "blocked")
      .map((profile) =>
        productionIntegrationRestriction({
          idParts: ["operational_risk", recordId(profile, ["operationalRiskId", "riskId", "id"]) || "unknown"],
          restrictionType: "operational_risk",
          status: "blocked",
          label: "Operational risk production integration restriction",
          description: "Unresolved operational risk blocks production integration readiness.",
          blockedReason: "Unresolved operational risk blocks production integration readiness.",
        })
      ),
    ...regulatoryProfiles
      .filter((profile) => referenceStatus(profile, ["ready_for_review", "verified"]) === "blocked")
      .map((profile) =>
        productionIntegrationRestriction({
          idParts: ["regulatory", recordId(profile, ["regulatoryProfileId", "id"]) || "unknown"],
          restrictionType: "regulatory",
          status: "blocked",
          label: "Regulatory production integration restriction",
          description: "Unresolved regulatory readiness blocks production integration readiness.",
          blockedReason: "Unresolved regulatory readiness blocks production integration readiness.",
        })
      ),
  ];
  const blockedReasons = [...allReferences.map((reference) => reference.blockedReason), ...integrationRestrictions.map((restriction) => restriction.blockedReason)].filter(Boolean) as string[];

  const canonicalEvents: ProductionIntegrationCanonicalEvent[] = [
    event({
      eventType: "production_integration_profile_derived",
      status,
      productionIntegrationId,
      summary:
        "Production integration profile derived from activation, observability, rollback, governance, review, evidence, risk, regulatory, and audit metadata.",
    }),
    event({
      eventType: "production_integration_redaction_applied",
      status,
      productionIntegrationId,
      summary:
        "Provider credentials, webhook secrets, API tokens, raw provider payloads, banking/payment payloads, settlement payloads, and private tenant data were excluded.",
    }),
  ];
  if (status === "sandbox_ready") {
    canonicalEvents.push(
      event({
        eventType: "production_integration_sandbox_ready",
        status,
        productionIntegrationId,
        summary: "Production integration is sandbox-ready for manual approval; autonomous execution remains disabled.",
      })
    );
  }
  if (status === "production_review_required" || status === "partially_ready") {
    canonicalEvents.push(
      event({
        eventType: "production_integration_review_required",
        status,
        productionIntegrationId,
        summary: "Manual production integration review is required before supervised activation metadata can be considered.",
      })
    );
  }
  if (status === "blocked") {
    canonicalEvents.push(
      event({
        eventType: "production_integration_blocked",
        status,
        productionIntegrationId,
        summary: "Production integration readiness is blocked by unresolved restrictions.",
      })
    );
  }

  return {
    productionIntegrationId,
    integrationType,
    status,
    manualApprovalRequired: true,
    autonomousExecutionEnabled: false,
    paymentExecutionEnabled: false,
    unrestrictedWebhookExecutionEnabled: false,
    generatedAt: generatedAt(input.generatedAt),
    summary: {
      totalReferences: allReferences.length,
      verifiedReferences: allReferences.filter((reference) => reference.status === "verified").length,
      partiallyVerifiedReferences: allReferences.filter((reference) => reference.status === "partially_verified").length,
      blockedReferences: allReferences.filter((reference) => reference.status === "blocked").length,
      unavailableReferences: allReferences.filter((reference) => reference.status === "unavailable").length,
      restrictions: integrationRestrictions.length,
    },
    activationReferences,
    observabilityReferences,
    rollbackReferences,
    reviewReferences,
    evidenceReferences,
    governanceReferences,
    auditReferences,
    integrationRestrictions,
    redactions: REDACTIONS,
    blockedReasons,
    canonicalEvents,
  };
}
