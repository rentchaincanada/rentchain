import type {
  DeriveEcosystemCoordinationSnapshotInput,
  EcosystemCoordinationCanonicalEvent,
  EcosystemCoordinationReference,
  EcosystemCoordinationReferenceStatus,
  EcosystemCoordinationReferenceType,
  EcosystemCoordinationSnapshot,
  EcosystemCoordinationStatus,
} from "./ecosystemCoordinationTypes";
import { ecosystemIdPart, ecosystemReference, ecosystemRestriction } from "./ecosystemRestrictionModels";

const DEFAULT_COORDINATION_KEY = "institutional-ecosystem-coordination-v1";

const REDACTIONS = [
  "Sensitive tenant, screening, private document, raw government ID, payment, banking, and settlement execution payloads are excluded.",
  "Unrestricted operational telemetry, provider payloads, deployment execution, onboarding execution, payment execution, and external execution controls are excluded.",
  "Ecosystem coordination is visibility metadata only; no autonomous orchestration, public networking, or external synchronization is enabled.",
  "Private review notes, unrestricted audit histories, provider credentials, webhook secrets, and tokens are excluded.",
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

function recordId(record: Record<string, any>, keys: string[]): string {
  for (const key of keys) {
    const value = asString(record?.[key], 240);
    if (value) return value;
  }
  return asString(record?.id, 240);
}

function referenceStatus(record: Record<string, any>, verifiedStatuses: string[]): EcosystemCoordinationReferenceStatus {
  const status = asString(record?.status || record?.state || record?.conclusion, 80).toLowerCase();
  if (status === "blocked" || status === "elevated" || status === "failure" || status === "failed" || status === "error" || status === "cancelled") return "blocked";
  if (verifiedStatuses.includes(status)) return "verified";
  if (status === "missing" || status === "unknown" || status === "unavailable" || status === "pending") return "unavailable";
  return "partially_verified";
}

function statusForType(referenceType: EcosystemCoordinationReferenceType, record: Record<string, any>): EcosystemCoordinationReferenceStatus {
  if (referenceType === "participant" || referenceType === "trust") return referenceStatus(record, ["verified"]);
  if (referenceType === "risk") return referenceStatus(record, ["stable"]);
  if (referenceType === "integration") return referenceStatus(record, ["ready_for_review", "sandbox_ready", "verified"]);
  if (referenceType === "review") return referenceStatus(record, ["ready_for_review", "completed", "verified"]);
  if (referenceType === "audit" && asString(record?.eventType, 120)) return "verified";
  return referenceStatus(record, ["ready_for_review", "verified"]);
}

function statusFromReferences(hasContext: boolean, references: EcosystemCoordinationReference[]): EcosystemCoordinationStatus {
  if (!hasContext) return "unknown";
  if (references.some((reference) => reference.status === "blocked")) return "blocked";
  const missingCritical = references.some(
    (reference) =>
      reference.status === "unavailable" &&
      (reference.referenceType === "observability" ||
        reference.referenceType === "governance" ||
        reference.referenceType === "review" ||
        reference.referenceType === "evidence" ||
        reference.referenceType === "risk")
  );
  if (missingCritical) return "review_required";
  if (references.some((reference) => reference.status === "unavailable" || reference.status === "partially_verified")) return "attention_required";
  return "stable";
}

function event(input: {
  eventType: EcosystemCoordinationCanonicalEvent["eventType"];
  status: EcosystemCoordinationStatus;
  ecosystemCoordinationId: string;
  summary: string;
}): EcosystemCoordinationCanonicalEvent {
  return {
    eventType: input.eventType,
    action: input.eventType.replace(/^ecosystem_coordination_/, "").replace(/_/g, "."),
    status: input.status,
    resourceType: "ecosystem_coordination_snapshot",
    resourceId: input.ecosystemCoordinationId,
    summary: input.summary,
  };
}

function referencesFor(input: {
  records: Record<string, any>[];
  fallback: string;
  referenceType: EcosystemCoordinationReferenceType;
  idKeys: string[];
  label: string;
  description: string;
  destination: string;
  blockedReason: string;
}): EcosystemCoordinationReference[] {
  if (!input.records.length) {
    return [
      ecosystemReference({
        idParts: [input.referenceType, "missing"],
        referenceType: input.referenceType,
        status: "unavailable",
        label: input.label,
        description: `${input.description} is unavailable for ecosystem coordination review.`,
        destination: input.destination,
      }),
    ];
  }
  return input.records.map((record, index) => {
    const id = recordId(record, input.idKeys) || `${input.fallback}-${index + 1}`;
    const status = statusForType(input.referenceType, record);
    return ecosystemReference({
      idParts: [input.referenceType, id],
      referenceType: input.referenceType,
      status,
      label: input.label,
      description: `${input.description} is available for ecosystem coordination review.`,
      lineageReferences: [id].filter(Boolean),
      destination: input.destination,
      redacted: Boolean(record.redacted),
      redactionReason: record.redacted ? `${input.label} payload is redacted for ecosystem coordination safety.` : null,
      blockedReason: status === "blocked" ? input.blockedReason : null,
    });
  });
}

export function deriveEcosystemCoordinationSnapshot(input: DeriveEcosystemCoordinationSnapshotInput): EcosystemCoordinationSnapshot {
  const coordinationKey = asString(input.coordinationKey, 160) || DEFAULT_COORDINATION_KEY;
  const ecosystemCoordinationId =
    ecosystemIdPart(["ecosystem_coordination", coordinationKey].join(":")) || "ecosystem_coordination:unknown";

  const networkParticipants = asArray(input.networkParticipants);
  const trustRelationships = asArray(input.trustRelationships);
  const onboardingReadiness = asArray(input.onboardingReadiness);
  const operationalRiskProfiles = asArray(input.operationalRiskProfiles);
  const interoperabilityAdapterReadiness = asArray(input.interoperabilityAdapterReadiness);
  const controlledIntegrationProfiles = asArray(input.controlledIntegrationProfiles);
  const settlementReadiness = asArray(input.settlementReadiness);
  const regulatoryProfiles = asArray(input.regulatoryProfiles);
  const observabilityReadiness = asArray(input.observabilityReadiness);
  const releaseGovernanceProfiles = asArray(input.releaseGovernanceProfiles);
  const publicExposureHardeningProfiles = asArray(input.publicExposureHardeningProfiles);
  const commercialReadinessProfiles = asArray(input.commercialReadinessProfiles);
  const evidencePacks = asArray(input.evidencePacks);
  const reviews = asArray(input.operatorReviewSessions);
  const auditEvents = asArray(input.auditEvents);

  const participantReferences = referencesFor({
    records: networkParticipants,
    fallback: "participant",
    referenceType: "participant",
    idKeys: ["participantId", "id"],
    label: "Network participant reference",
    description: "Network participant profile metadata",
    destination: "/network-participants",
    blockedReason: "Network participant profile is blocked.",
  });
  const trustReferences = referencesFor({
    records: trustRelationships,
    fallback: "trust",
    referenceType: "trust",
    idKeys: ["trustRelationshipId", "id"],
    label: "Cross-organization trust reference",
    description: "Cross-organization trust metadata",
    destination: "/cross-organization-trust",
    blockedReason: "Cross-organization trust relationship is blocked.",
  });
  const onboardingReferences = referencesFor({
    records: onboardingReadiness,
    fallback: "onboarding",
    referenceType: "onboarding",
    idKeys: ["onboardingReadinessId", "id"],
    label: "Institution onboarding readiness reference",
    description: "Institution onboarding readiness metadata",
    destination: "/institution-onboarding-readiness",
    blockedReason: "Institution onboarding readiness is blocked.",
  });
  const riskReferences = referencesFor({
    records: operationalRiskProfiles,
    fallback: "risk",
    referenceType: "risk",
    idKeys: ["operationalRiskId", "id"],
    label: "Operational risk reference",
    description: "Operational risk metadata",
    destination: "/operational-risk",
    blockedReason: "Unresolved operational risk blocks ecosystem coordination.",
  });
  const integrationReferences = [
    ...referencesFor({
      records: interoperabilityAdapterReadiness,
      fallback: "interoperability",
      referenceType: "integration",
      idKeys: ["adapterReadinessId", "id"],
      label: "Interoperability readiness reference",
      description: "Interoperability readiness metadata",
      destination: "/interoperability-adapters",
      blockedReason: "Interoperability readiness is blocked.",
    }),
    ...referencesFor({
      records: controlledIntegrationProfiles,
      fallback: "controlled-integration",
      referenceType: "integration",
      idKeys: ["controlledIntegrationId", "id"],
      label: "Controlled integration readiness reference",
      description: "Controlled integration readiness metadata",
      destination: "/admin/controlled-integrations",
      blockedReason: "Controlled integration readiness is blocked.",
    }),
  ];
  const settlementReferences = referencesFor({
    records: settlementReadiness,
    fallback: "settlement",
    referenceType: "settlement",
    idKeys: ["settlementReadinessId", "id"],
    label: "Settlement readiness reference",
    description: "Settlement readiness metadata",
    destination: "/settlement-readiness",
    blockedReason: "Settlement readiness is blocked.",
  });
  const regulatoryReferences = referencesFor({
    records: regulatoryProfiles,
    fallback: "regulatory",
    referenceType: "regulatory",
    idKeys: ["regulatoryProfileId", "id"],
    label: "Regulatory profile reference",
    description: "Regulatory profile metadata",
    destination: "/regulatory-profiles",
    blockedReason: "Regulatory restriction blocks ecosystem coordination.",
  });
  const observabilityReferences = referencesFor({
    records: observabilityReadiness,
    fallback: "observability",
    referenceType: "observability",
    idKeys: ["observabilityIncidentReadinessId", "id"],
    label: "Observability readiness reference",
    description: "Observability and incident readiness metadata",
    destination: "/admin/observability-incident-readiness",
    blockedReason: "Observability readiness is blocked.",
  });
  const governanceReferences = [
    ...referencesFor({
      records: releaseGovernanceProfiles,
      fallback: "release-governance",
      referenceType: "governance",
      idKeys: ["releaseGovernanceId", "releaseVersion", "id"],
      label: "Release governance reference",
      description: "Release governance metadata",
      destination: "/admin/release-governance",
      blockedReason: "Release governance is blocked.",
    }),
    ...referencesFor({
      records: publicExposureHardeningProfiles,
      fallback: "public-exposure",
      referenceType: "governance",
      idKeys: ["publicExposureHardeningId", "id"],
      label: "Public exposure hardening reference",
      description: "Public exposure hardening metadata",
      destination: "/admin/public-exposure-hardening",
      blockedReason: "Public exposure hardening is blocked.",
    }),
    ...referencesFor({
      records: commercialReadinessProfiles,
      fallback: "commercial-readiness",
      referenceType: "governance",
      idKeys: ["commercialReadinessId", "id"],
      label: "Commercial readiness reference",
      description: "Commercial readiness metadata",
      destination: "/admin/commercial-readiness",
      blockedReason: "Commercial readiness is blocked.",
    }),
  ];
  const evidenceReferences = referencesFor({
    records: evidencePacks,
    fallback: "evidence",
    referenceType: "evidence",
    idKeys: ["evidencePackId", "id"],
    label: "Evidence lineage reference",
    description: "Evidence lineage metadata",
    destination: "/evidence-packs",
    blockedReason: "Evidence lineage is blocked.",
  });
  const reviewReferences = referencesFor({
    records: reviews,
    fallback: "review",
    referenceType: "review",
    idKeys: ["reviewSessionId", "id"],
    label: "Review lineage reference",
    description: "Operator review lineage metadata",
    destination: "/review-timeline",
    blockedReason: "Review lineage is blocked.",
  });
  const auditReferences = referencesFor({
    records: auditEvents.slice(0, 20),
    fallback: "audit",
    referenceType: "audit",
    idKeys: ["eventId", "id"],
    label: "Audit lineage reference",
    description: "Canonical audit event metadata",
    destination: "/review-timeline",
    blockedReason: "Audit lineage is blocked.",
  });

  const allReferences = [
    ...participantReferences,
    ...trustReferences,
    ...onboardingReferences,
    ...riskReferences,
    ...integrationReferences,
    ...settlementReferences,
    ...regulatoryReferences,
    ...observabilityReferences,
    ...governanceReferences,
    ...evidenceReferences,
    ...reviewReferences,
    ...auditReferences,
  ];

  const ecosystemRestrictions = allReferences
    .filter((reference) => reference.status !== "verified")
    .map((reference) =>
      ecosystemRestriction({
        idParts: [reference.referenceType, reference.referenceId],
        restrictionType: reference.referenceType,
        status: reference.status === "blocked" ? "blocked" : "review_required",
        label: `${reference.label} restriction`,
        description: `${reference.label} is incomplete or blocked for ecosystem coordination.`,
        blockedReason: reference.blockedReason,
      })
    );

  const hasContext = Boolean(
    networkParticipants.length ||
      trustRelationships.length ||
      onboardingReadiness.length ||
      operationalRiskProfiles.length ||
      interoperabilityAdapterReadiness.length ||
      controlledIntegrationProfiles.length ||
      settlementReadiness.length ||
      regulatoryProfiles.length ||
      observabilityReadiness.length ||
      releaseGovernanceProfiles.length ||
      publicExposureHardeningProfiles.length ||
      commercialReadinessProfiles.length ||
      evidencePacks.length ||
      reviews.length ||
      auditEvents.length
  );
  const status = statusFromReferences(hasContext, allReferences);
  const blockedReasons = [...allReferences.map((reference) => reference.blockedReason), ...ecosystemRestrictions.map((restriction) => restriction.blockedReason)].filter(Boolean) as string[];

  const canonicalEvents: EcosystemCoordinationCanonicalEvent[] = [
    event({
      eventType: "ecosystem_coordination_snapshot_derived",
      status,
      ecosystemCoordinationId,
      summary:
        "Ecosystem coordination snapshot derived from participant, trust, onboarding, risk, integration, settlement, regulatory, observability, governance, evidence, review, and audit metadata.",
    }),
    event({
      eventType: "ecosystem_coordination_redaction_applied",
      status,
      ecosystemCoordinationId,
      summary:
        "Sensitive tenant, raw government ID, payment, banking, unrestricted telemetry, deployment, onboarding, orchestration, and external execution payloads were excluded.",
    }),
  ];
  if (ecosystemRestrictions.length) {
    canonicalEvents.push(
      event({
        eventType: "ecosystem_coordination_restriction_detected",
        status,
        ecosystemCoordinationId,
        summary: "Ecosystem restrictions are visible for manual governance review.",
      })
    );
  }
  if (status === "review_required" || status === "attention_required") {
    canonicalEvents.push(
      event({
        eventType: "ecosystem_coordination_review_required",
        status,
        ecosystemCoordinationId,
        summary: "Manual ecosystem coordination review is required.",
      })
    );
  }
  if (status === "blocked") {
    canonicalEvents.push(
      event({
        eventType: "ecosystem_coordination_blocked",
        status,
        ecosystemCoordinationId,
        summary: "Ecosystem coordination is blocked by unresolved restrictions.",
      })
    );
  }

  return {
    ecosystemCoordinationId,
    status,
    manualReviewRequired: true,
    autonomousCoordinationEnabled: false,
    externalExecutionEnabled: false,
    generatedAt: generatedAt(input.generatedAt),
    summary: {
      totalReferences: allReferences.length,
      verifiedReferences: allReferences.filter((reference) => reference.status === "verified").length,
      partiallyVerifiedReferences: allReferences.filter((reference) => reference.status === "partially_verified").length,
      blockedReferences: allReferences.filter((reference) => reference.status === "blocked").length,
      unavailableReferences: allReferences.filter((reference) => reference.status === "unavailable").length,
      restrictions: ecosystemRestrictions.length,
    },
    participantReferences,
    trustReferences,
    onboardingReferences,
    riskReferences,
    integrationReferences,
    settlementReferences,
    regulatoryReferences,
    observabilityReferences,
    governanceReferences,
    reviewReferences,
    evidenceReferences,
    auditReferences,
    ecosystemRestrictions,
    redactions: REDACTIONS,
    blockedReasons,
    canonicalEvents,
  };
}
