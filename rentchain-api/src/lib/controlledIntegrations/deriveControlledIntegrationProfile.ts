import type {
  ControlledIntegrationCanonicalEvent,
  ControlledIntegrationProfile,
  ControlledIntegrationReference,
  ControlledIntegrationStatus,
  ControlledIntegrationType,
  DeriveControlledIntegrationProfileInput,
} from "./controlledIntegrationTypes";
import {
  controlledIntegrationIdPart,
  controlledIntegrationReference,
  controlledIntegrationRestriction,
} from "./integrationRestrictionModels";

const INTEGRATION_TYPES = new Set<ControlledIntegrationType>([
  "registry",
  "lender",
  "insurer",
  "regulator",
  "accounting",
  "payment_provider",
  "operational_partner",
]);

const REDACTIONS = [
  "Provider credentials, webhook secrets, API tokens, and integration execution payloads are excluded.",
  "Sensitive tenant, screening, banking, payment, settlement, and private document payloads are excluded.",
  "Controlled integrations are readiness and governance metadata only; no autonomous synchronization or unrestricted external execution is enabled.",
  "Raw provider webhooks, unrestricted external API payloads, and unrestricted regulator/lender/payment-provider data exchange are excluded.",
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

function normalizeIntegrationType(value: unknown): ControlledIntegrationType {
  const raw = asString(value, 80) as ControlledIntegrationType;
  return INTEGRATION_TYPES.has(raw) ? raw : "operational_partner";
}

function recordId(record: Record<string, any>, keys: string[]): string {
  for (const key of keys) {
    const value = asString(record?.[key], 240);
    if (value) return value;
  }
  return asString(record?.id, 240);
}

function isDisabled(metadata: Record<string, any> | null): boolean {
  const status = asString(metadata?.status || metadata?.state, 80).toLowerCase();
  return !metadata || status === "disabled" || status === "inactive" || status === "off";
}

function statusFromRecord(record: Record<string, any>, verifiedStatuses: string[]): ControlledIntegrationReference["status"] {
  const status = asString(record?.status || record?.state || record?.conclusion, 80).toLowerCase();
  if (status === "blocked" || status === "failure" || status === "failed" || status === "error" || status === "cancelled") return "blocked";
  if (verifiedStatuses.includes(status)) return "verified";
  if (status === "missing" || status === "unknown" || status === "unavailable" || status === "pending") return "unavailable";
  return "partially_verified";
}

function adapterStatus(record: Record<string, any>): ControlledIntegrationReference["status"] {
  const status = asString(record?.status, 80);
  if (status === "blocked") return "blocked";
  if (status === "ready_for_review") return "verified";
  if (status === "unknown" || status === "review_required") return "unavailable";
  return "partially_verified";
}

function releaseStatus(record: Record<string, any>): ControlledIntegrationReference["status"] {
  const status = asString(record?.status, 80);
  if (status === "blocked") return "blocked";
  if (status === "ready_for_review") return "verified";
  if (status === "unknown" || status === "review_required") return "unavailable";
  return "partially_verified";
}

function operationalRiskStatus(record: Record<string, any>): ControlledIntegrationReference["status"] {
  const status = asString(record?.status, 80);
  if (status === "blocked" || status === "elevated") return "blocked";
  if (status === "stable") return "verified";
  if (status === "unknown") return "unavailable";
  return "partially_verified";
}

function readinessStatus(input: {
  disabled: boolean;
  references: ControlledIntegrationReference[];
  operationalRiskProfiles: Record<string, any>[];
}): ControlledIntegrationStatus {
  if (input.disabled) return "disabled";
  if (input.references.some((reference) => reference.status === "blocked") || input.operationalRiskProfiles.some((profile) => operationalRiskStatus(profile) === "blocked")) return "blocked";
  const criticalMissing = input.references.some(
    (reference) =>
      reference.status === "unavailable" &&
      (reference.referenceType === "adapter" ||
        reference.referenceType === "review" ||
        reference.referenceType === "evidence" ||
        reference.referenceType === "observability" ||
        reference.referenceType === "governance")
  );
  if (criticalMissing) return "review_required";
  if (input.references.some((reference) => reference.status === "unavailable" || reference.status === "partially_verified")) return "partially_ready";
  return "sandbox_ready";
}

function event(input: {
  eventType: ControlledIntegrationCanonicalEvent["eventType"];
  status: ControlledIntegrationStatus;
  controlledIntegrationId: string;
  summary: string;
}): ControlledIntegrationCanonicalEvent {
  return {
    eventType: input.eventType,
    action: input.eventType.replace(/^controlled_integration_/, "").replace(/_/g, "."),
    status: input.status,
    resourceType: "controlled_integration_profile",
    resourceId: input.controlledIntegrationId,
    summary: input.summary,
  };
}

export function deriveControlledIntegrationProfile(input: DeriveControlledIntegrationProfileInput): ControlledIntegrationProfile {
  const integrationType = normalizeIntegrationType(input.integrationType);
  const integrationKey = asString(input.integrationKey, 160) || integrationType;
  const controlledIntegrationId =
    controlledIntegrationIdPart(["controlled_integration", integrationKey, integrationType].join(":")) ||
    "controlled_integration:unknown";
  const activationMetadata = input.activationMetadata || null;
  const disabled = isDisabled(activationMetadata);

  const adapterReadiness = asArray(input.adapterReadiness);
  const reviews = asArray(input.operatorReviewSessions);
  const evidencePacks = asArray(input.evidencePacks);
  const settlementReadiness = asArray(input.settlementReadiness);
  const regulatoryProfiles = asArray(input.regulatoryProfiles);
  const observabilityIncidentReadiness = asArray(input.observabilityIncidentReadiness);
  const releaseGovernanceProfiles = asArray(input.releaseGovernanceProfiles);
  const operationalRiskProfiles = asArray(input.operationalRiskProfiles);
  const auditEvents = asArray(input.auditEvents);

  const adapterReferences = adapterReadiness.length
    ? adapterReadiness.map((adapter) => {
        const status = adapterStatus(adapter);
        return controlledIntegrationReference({
          idParts: ["adapter", recordId(adapter, ["adapterReadinessId", "adapterId", "id"]) || "unknown"],
          referenceType: "adapter",
          status,
          label: "Adapter readiness reference",
          description: "Interoperability adapter readiness is available for controlled integration review.",
          lineageReferences: [recordId(adapter, ["adapterReadinessId", "adapterId", "id"])].filter(Boolean),
          destination: "/interoperability-adapters",
          blockedReason: status === "blocked" ? "Adapter readiness is blocked." : null,
        });
      })
    : [
        controlledIntegrationReference({
          idParts: ["adapter", "missing"],
          referenceType: "adapter",
          status: "unavailable",
          label: "Adapter readiness reference",
          description: "Interoperability adapter readiness is unavailable.",
          destination: "/interoperability-adapters",
        }),
      ];

  const reviewReferences = reviews.length
    ? reviews.map((review) => {
        const status = review.status === "completed" ? "verified" : review.status === "blocked" ? "blocked" : "partially_verified";
        return controlledIntegrationReference({
          idParts: ["review", recordId(review, ["reviewSessionId", "id"]) || "unknown"],
          referenceType: "review",
          status,
          label: "Review lineage reference",
          description: "Operator review lineage is available for controlled integration governance.",
          lineageReferences: [recordId(review, ["reviewSessionId", "id"])].filter(Boolean),
          destination: "/review-timeline",
          blockedReason: status === "blocked" ? "Operator review lineage is blocked." : null,
        });
      })
    : [
        controlledIntegrationReference({
          idParts: ["review", "missing"],
          referenceType: "review",
          status: "unavailable",
          label: "Review lineage reference",
          description: "Operator review lineage is unavailable.",
          destination: "/review-timeline",
        }),
      ];

  const evidenceReferences = evidencePacks.length
    ? evidencePacks.map((pack) => {
        const status = statusFromRecord(pack, ["ready_for_review", "verified"]);
        return controlledIntegrationReference({
          idParts: ["evidence", recordId(pack, ["evidencePackId", "id"]) || "unknown"],
          referenceType: "evidence",
          status,
          label: "Evidence lineage reference",
          description: "Evidence lineage is available for controlled integration governance.",
          lineageReferences: [recordId(pack, ["evidencePackId", "id"])].filter(Boolean),
          destination: "/evidence-packs",
          blockedReason: status === "blocked" ? "Evidence lineage is blocked." : null,
        });
      })
    : [
        controlledIntegrationReference({
          idParts: ["evidence", "missing"],
          referenceType: "evidence",
          status: "unavailable",
          label: "Evidence lineage reference",
          description: "Evidence lineage is unavailable.",
          destination: "/evidence-packs",
        }),
      ];

  const settlementReferences = settlementReadiness.length
    ? settlementReadiness.map((settlement) => {
        const status = statusFromRecord(settlement, ["ready_for_review", "verified"]);
        return controlledIntegrationReference({
          idParts: ["settlement", recordId(settlement, ["settlementReadinessId", "id"]) || "unknown"],
          referenceType: "settlement",
          status,
          label: "Settlement integration restriction reference",
          description: "Settlement readiness metadata is available for controlled integration review.",
          lineageReferences: [recordId(settlement, ["settlementReadinessId", "id"])].filter(Boolean),
          destination: "/settlement-readiness",
          blockedReason: status === "blocked" ? "Settlement readiness blocks controlled integration." : null,
        });
      })
    : [
        controlledIntegrationReference({
          idParts: ["settlement", "missing"],
          referenceType: "settlement",
          status: "unavailable",
          label: "Settlement integration restriction reference",
          description: "Settlement readiness metadata is unavailable.",
          destination: "/settlement-readiness",
        }),
      ];

  const regulatoryReferences = regulatoryProfiles.length
    ? regulatoryProfiles.map((profile) => {
        const status = statusFromRecord(profile, ["ready_for_review", "verified"]);
        return controlledIntegrationReference({
          idParts: ["regulatory", recordId(profile, ["regulatoryProfileId", "id"]) || "unknown"],
          referenceType: "regulatory",
          status,
          label: "Regulatory integration restriction reference",
          description: "Regulatory profile metadata is available for controlled integration review.",
          lineageReferences: [recordId(profile, ["regulatoryProfileId", "id"])].filter(Boolean),
          destination: "/regulatory-profiles",
          blockedReason: status === "blocked" ? "Regulatory readiness blocks controlled integration." : null,
        });
      })
    : [
        controlledIntegrationReference({
          idParts: ["regulatory", "missing"],
          referenceType: "regulatory",
          status: "unavailable",
          label: "Regulatory integration restriction reference",
          description: "Regulatory profile metadata is unavailable.",
          destination: "/regulatory-profiles",
        }),
      ];

  const observabilityReferences = observabilityIncidentReadiness.length
    ? observabilityIncidentReadiness.map((readiness) => {
        const status = statusFromRecord(readiness, ["ready_for_review", "verified"]);
        return controlledIntegrationReference({
          idParts: ["observability", recordId(readiness, ["observabilityIncidentReadinessId", "id"]) || "unknown"],
          referenceType: "observability",
          status,
          label: "Observability readiness reference",
          description: "Observability and incident readiness is available for controlled integration review.",
          lineageReferences: [recordId(readiness, ["observabilityIncidentReadinessId", "id"])].filter(Boolean),
          destination: "/admin/observability-incident-readiness",
          blockedReason: status === "blocked" ? "Observability readiness blocks controlled integration." : null,
        });
      })
    : [
        controlledIntegrationReference({
          idParts: ["observability", "missing"],
          referenceType: "observability",
          status: "unavailable",
          label: "Observability readiness reference",
          description: "Observability readiness metadata is unavailable.",
          destination: "/admin/observability-incident-readiness",
        }),
      ];

  const releaseGovernanceReferences = releaseGovernanceProfiles.length
    ? releaseGovernanceProfiles.map((profile) => {
        const status = releaseStatus(profile);
        return controlledIntegrationReference({
          idParts: ["governance", recordId(profile, ["releaseGovernanceId", "releaseVersion", "id"]) || "unknown"],
          referenceType: "governance",
          status,
          label: "Release governance reference",
          description: "Release governance metadata is available for controlled integration review.",
          lineageReferences: [recordId(profile, ["releaseGovernanceId", "releaseVersion", "id"])].filter(Boolean),
          destination: "/admin/release-governance",
          blockedReason: status === "blocked" ? "Release governance readiness is blocked." : null,
        });
      })
    : [
        controlledIntegrationReference({
          idParts: ["governance", "missing"],
          referenceType: "governance",
          status: "unavailable",
          label: "Release governance reference",
          description: "Release governance metadata is unavailable.",
          destination: "/admin/release-governance",
        }),
      ];

  const auditReferences = auditEvents.length
    ? auditEvents.slice(0, 20).map((record) =>
        controlledIntegrationReference({
          idParts: ["audit", recordId(record, ["eventId", "id"]) || "unknown"],
          referenceType: "audit",
          status: record.redacted ? "partially_verified" : "verified",
          label: "Audit lineage reference",
          description: "Canonical audit event metadata is available for controlled integration governance.",
          lineageReferences: [recordId(record, ["eventId", "id"])].filter(Boolean),
          destination: "/review-timeline",
          redacted: Boolean(record.redacted),
          redactionReason: record.redacted ? "Audit payload is redacted for controlled integration safety." : null,
        })
      )
    : [
        controlledIntegrationReference({
          idParts: ["audit", "missing"],
          referenceType: "audit",
          status: "unavailable",
          label: "Audit lineage reference",
          description: "Canonical audit event metadata is unavailable.",
          destination: "/review-timeline",
        }),
      ];

  const allReferences = [
    ...adapterReferences,
    ...reviewReferences,
    ...evidenceReferences,
    ...settlementReferences,
    ...regulatoryReferences,
    ...observabilityReferences,
    ...releaseGovernanceReferences,
    ...auditReferences,
  ];

  const integrationRestrictions = [
    ...allReferences
      .filter((reference) => reference.status !== "verified")
      .map((reference) =>
        controlledIntegrationRestriction({
          idParts: [reference.referenceType, reference.referenceId],
          restrictionType: reference.referenceType,
          status: reference.status === "blocked" ? "blocked" : "review_required",
          label: `${reference.label} restriction`,
          description: `${reference.label} is incomplete or blocked for controlled integration readiness.`,
          blockedReason: reference.blockedReason,
        })
      ),
    ...operationalRiskProfiles
      .filter((profile) => operationalRiskStatus(profile) === "blocked")
      .map((profile) =>
        controlledIntegrationRestriction({
          idParts: ["operational_risk", recordId(profile, ["operationalRiskId", "id"]) || "unknown"],
          restrictionType: "provider_execution",
          status: "blocked",
          label: "Operational risk integration restriction",
          description: "Unresolved operational risk blocks controlled integration readiness.",
          blockedReason: "Unresolved operational risk blocks controlled integration readiness.",
        })
      ),
  ];

  const status = readinessStatus({ disabled, references: allReferences, operationalRiskProfiles });
  const blockedReasons = [...allReferences.map((reference) => reference.blockedReason), ...integrationRestrictions.map((restriction) => restriction.blockedReason)].filter(Boolean) as string[];

  const canonicalEvents: ControlledIntegrationCanonicalEvent[] = [
    event({
      eventType: "controlled_integration_profile_derived",
      status,
      controlledIntegrationId,
      summary:
        "Controlled integration profile derived from adapter, review, evidence, settlement, regulatory, observability, release governance, risk, and audit metadata.",
    }),
    event({
      eventType: "controlled_integration_redaction_applied",
      status,
      controlledIntegrationId,
      summary:
        "Provider credentials, webhook secrets, API tokens, raw provider payloads, banking/payment payloads, and private tenant data were excluded.",
    }),
  ];
  if (status === "sandbox_ready") {
    canonicalEvents.push(
      event({
        eventType: "controlled_integration_sandbox_ready",
        status,
        controlledIntegrationId,
        summary: "Controlled integration is sandbox-ready for manual review; live synchronization remains disabled.",
      })
    );
  }
  if (status === "review_required" || status === "partially_ready") {
    canonicalEvents.push(
      event({
        eventType: "controlled_integration_review_required",
        status,
        controlledIntegrationId,
        summary: "Manual controlled integration review is required before activation metadata can be considered.",
      })
    );
  }
  if (status === "blocked") {
    canonicalEvents.push(
      event({
        eventType: "controlled_integration_blocked",
        status,
        controlledIntegrationId,
        summary: "Controlled integration readiness is blocked by unresolved restrictions.",
      })
    );
  }

  return {
    controlledIntegrationId,
    integrationType,
    status,
    manualApprovalRequired: true,
    liveSynchronizationEnabled: false,
    autonomousExecutionEnabled: false,
    webhookExecutionEnabled: false,
    generatedAt: generatedAt(input.generatedAt),
    summary: {
      totalReferences: allReferences.length,
      verifiedReferences: allReferences.filter((reference) => reference.status === "verified").length,
      partiallyVerifiedReferences: allReferences.filter((reference) => reference.status === "partially_verified").length,
      blockedReferences: allReferences.filter((reference) => reference.status === "blocked").length,
      unavailableReferences: allReferences.filter((reference) => reference.status === "unavailable").length,
      restrictions: integrationRestrictions.length,
    },
    adapterReferences,
    reviewReferences,
    evidenceReferences,
    settlementReferences,
    regulatoryReferences,
    observabilityReferences,
    releaseGovernanceReferences,
    auditReferences,
    integrationRestrictions,
    redactions: REDACTIONS,
    blockedReasons,
    canonicalEvents,
  };
}
