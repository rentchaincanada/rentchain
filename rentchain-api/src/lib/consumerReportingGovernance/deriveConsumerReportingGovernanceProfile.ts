import type {
  ConsumerReportingCanonicalEvent,
  ConsumerReportingGovernanceProfile,
  ConsumerReportingGovernanceStatus,
  DeriveConsumerReportingGovernanceProfileInput,
  ReportingReference,
  ReportingReferenceStatus,
  ReportingReferenceType,
} from "./consumerReportingGovernanceTypes";
import { reportingIdPart, reportingReference, reportingRestriction } from "./reportingRestrictionModels";

const DEFAULT_GOVERNANCE_KEY = "institutional-consumer-reporting-governance-v1";

const REDACTIONS = [
  "CRA status claims, bureau approval claims, bureau credentials, and reporting execution payloads are excluded.",
  "Raw screening, credit bureau, government ID, tenant private document, payment account, and banking payloads are excluded.",
  "Consumer reporting governance is visibility metadata only; no bureau execution, collections execution, adverse-action execution, or autonomous reporting is enabled.",
  "Public tenant scoring, public reporting marketplaces, and unrestricted consumer-reporting distribution are excluded.",
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

function referenceStatus(record: Record<string, any>, verifiedStatuses: string[]): ReportingReferenceStatus {
  const status = asString(record?.status || record?.state || record?.conclusion, 80).toLowerCase();
  if (status === "blocked" || status === "elevated" || status === "failure" || status === "failed" || status === "error" || status === "cancelled") return "blocked";
  if (verifiedStatuses.includes(status)) return "verified";
  if (status === "missing" || status === "unknown" || status === "unavailable" || status === "pending") return "unavailable";
  return "partially_verified";
}

function statusForType(referenceType: ReportingReferenceType, record: Record<string, any>): ReportingReferenceStatus {
  if (referenceType === "credentialing") return referenceStatus(record, ["ready_for_review", "verified", "stable"]);
  if (referenceType === "review") return referenceStatus(record, ["ready_for_review", "completed", "verified"]);
  if (referenceType === "audit" && asString(record?.eventType, 120)) return "verified";
  return referenceStatus(record, ["ready_for_review", "verified", "stable", "available", "configured"]);
}

function governanceStatus(hasContext: boolean, references: ReportingReference[]): ConsumerReportingGovernanceStatus {
  if (!hasContext) return "unknown";
  if (references.some((reference) => reference.status === "blocked" && (reference.referenceType === "consent" || reference.referenceType === "dispute"))) return "blocked";
  const criticalMissing = references.some(
    (reference) =>
      reference.status === "unavailable" &&
      (reference.referenceType === "consent" ||
        reference.referenceType === "dispute" ||
        reference.referenceType === "audit" ||
        reference.referenceType === "evidence" ||
        reference.referenceType === "review")
  );
  if (criticalMissing) return "review_required";
  if (references.some((reference) => reference.status === "blocked" || reference.status === "unavailable" || reference.status === "partially_verified")) return "partially_ready";
  return "ready_for_review";
}

function event(input: {
  eventType: ConsumerReportingCanonicalEvent["eventType"];
  status: ConsumerReportingGovernanceStatus;
  consumerReportingGovernanceId: string;
  summary: string;
}): ConsumerReportingCanonicalEvent {
  return {
    eventType: input.eventType,
    action: input.eventType.replace(/^consumer_reporting_/, "").replace(/_/g, "."),
    status: input.status,
    resourceType: "consumer_reporting_governance_profile",
    resourceId: input.consumerReportingGovernanceId,
    summary: input.summary,
  };
}

function referencesFor(input: {
  records: Record<string, any>[];
  fallback: string;
  referenceType: ReportingReferenceType;
  idKeys: string[];
  label: string;
  description: string;
  destination: string;
  blockedReason: string;
}): ReportingReference[] {
  if (!input.records.length) {
    return [
      reportingReference({
        idParts: [input.referenceType, "missing"],
        referenceType: input.referenceType,
        status: "unavailable",
        label: input.label,
        description: `${input.description} is unavailable for consumer reporting governance review.`,
        destination: input.destination,
      }),
    ];
  }
  return input.records.map((record, index) => {
    const id = recordId(record, input.idKeys) || `${input.fallback}-${index + 1}`;
    const status = statusForType(input.referenceType, record);
    return reportingReference({
      idParts: [input.referenceType, id],
      referenceType: input.referenceType,
      status,
      label: input.label,
      description: `${input.description} is available for consumer reporting governance review.`,
      lineageReferences: [id].filter(Boolean),
      destination: input.destination,
      redacted: Boolean(record.redacted),
      redactionReason: record.redacted ? `${input.label} payload is redacted for reporting governance safety.` : null,
      blockedReason: status === "blocked" ? input.blockedReason : null,
    });
  });
}

export function deriveConsumerReportingGovernanceProfile(input: DeriveConsumerReportingGovernanceProfileInput): ConsumerReportingGovernanceProfile {
  const governanceKey = asString(input.governanceKey, 160) || DEFAULT_GOVERNANCE_KEY;
  const consumerReportingGovernanceId =
    reportingIdPart(["consumer_reporting_governance", governanceKey].join(":")) || "consumer_reporting_governance:unknown";

  const consentGovernance = asArray(input.consentGovernance);
  const disputeGovernance = asArray(input.disputeGovernance);
  const adverseActionReadiness = asArray(input.adverseActionReadiness);
  const credentialingReadiness = asArray(input.credentialingReadiness);
  const operationalRiskProfiles = asArray(input.operationalRiskProfiles);
  const rentalHistoryLineage = asArray(input.rentalHistoryLineage);
  const evidencePacks = asArray(input.evidencePacks);
  const reviews = asArray(input.operatorReviewSessions);
  const auditEvents = asArray(input.auditEvents);

  const consentReferences = referencesFor({
    records: consentGovernance,
    fallback: "consent",
    referenceType: "consent",
    idKeys: ["consentGovernanceId", "consentId", "identityConsentId", "id"],
    label: "Consent governance reference",
    description: "Consent governance and access-control metadata",
    destination: "/identity-layer",
    blockedReason: "Consent lineage is missing or blocked.",
  });
  const disputeReferences = referencesFor({
    records: disputeGovernance,
    fallback: "dispute",
    referenceType: "dispute",
    idKeys: ["disputeGovernanceId", "disputeId", "caseId", "id"],
    label: "Dispute governance reference",
    description: "Dispute governance readiness metadata",
    destination: "/review-timeline",
    blockedReason: "Dispute governance readiness is blocked.",
  });
  const adverseActionReferences = referencesFor({
    records: adverseActionReadiness,
    fallback: "adverse-action",
    referenceType: "adverse_action",
    idKeys: ["adverseActionReadinessId", "adverseActionId", "id"],
    label: "Adverse-action governance reference",
    description: "Adverse-action governance readiness metadata",
    destination: "/review-timeline",
    blockedReason: "Adverse-action governance readiness is blocked.",
  });
  const credentialingReferences = referencesFor({
    records: [...credentialingReadiness, ...operationalRiskProfiles, ...rentalHistoryLineage],
    fallback: "credentialing",
    referenceType: "credentialing",
    idKeys: ["platformCredentialingId", "operationalRiskId", "rentalHistoryLedgerId", "id"],
    label: "Credentialing and reporting readiness reference",
    description: "Credentialing, operational-risk, and rental-history governance metadata",
    destination: "/admin/platform-credentialing-readiness",
    blockedReason: "Credentialing or reporting readiness is blocked.",
  });
  const reviewReferences = referencesFor({
    records: reviews,
    fallback: "review",
    referenceType: "review",
    idKeys: ["reviewSessionId", "id"],
    label: "Reporting review lineage reference",
    description: "Reporting review lineage metadata",
    destination: "/review-timeline",
    blockedReason: "Reporting review lineage is blocked.",
  });
  const evidenceReferences = referencesFor({
    records: evidencePacks,
    fallback: "evidence",
    referenceType: "evidence",
    idKeys: ["evidencePackId", "id"],
    label: "Reporting evidence lineage reference",
    description: "Reporting evidence lineage metadata",
    destination: "/evidence-packs",
    blockedReason: "Reporting evidence lineage is blocked.",
  });
  const auditReferences = referencesFor({
    records: auditEvents.slice(0, 20),
    fallback: "audit",
    referenceType: "audit",
    idKeys: ["eventId", "auditId", "id"],
    label: "Reporting audit lineage reference",
    description: "Reporting audit lineage metadata",
    destination: "/review-timeline",
    blockedReason: "Reporting audit lineage is blocked.",
  });

  const allReferences = [
    ...consentReferences,
    ...disputeReferences,
    ...adverseActionReferences,
    ...credentialingReferences,
    ...reviewReferences,
    ...evidenceReferences,
    ...auditReferences,
  ];
  const hasContext = Boolean(
    consentGovernance.length ||
      disputeGovernance.length ||
      adverseActionReadiness.length ||
      credentialingReadiness.length ||
      operationalRiskProfiles.length ||
      rentalHistoryLineage.length ||
      evidencePacks.length ||
      reviews.length ||
      auditEvents.length
  );
  const status = governanceStatus(hasContext, allReferences);
  const reportingRestrictions = allReferences
    .filter((reference) => reference.status !== "verified")
    .map((reference) =>
      reportingRestriction({
        idParts: [reference.referenceType, reference.referenceId],
        restrictionType: reference.referenceType,
        status: reference.status === "blocked" ? "blocked" : "review_required",
        label: `${reference.label} restriction`,
        description: `${reference.label} is incomplete or blocked for consumer reporting governance.`,
        blockedReason: reference.blockedReason,
      })
    );
  const blockedReasons = [...allReferences.map((reference) => reference.blockedReason), ...reportingRestrictions.map((restriction) => restriction.blockedReason)].filter(Boolean) as string[];

  const canonicalEvents: ConsumerReportingCanonicalEvent[] = [
    event({
      eventType: "consumer_reporting_governance_profile_derived",
      status,
      consumerReportingGovernanceId,
      summary:
        "Consumer reporting governance profile derived from consent, dispute, adverse-action, credentialing, review, evidence, and audit metadata.",
    }),
    event({
      eventType: "consumer_reporting_redaction_applied",
      status,
      consumerReportingGovernanceId,
      summary:
        "CRA claims, bureau credentials, raw screening, bureau, government ID, payment, private tenant, collections, and public scoring payloads were excluded.",
    }),
  ];
  if (reportingRestrictions.length) {
    canonicalEvents.push(
      event({
        eventType: "consumer_reporting_restriction_detected",
        status,
        consumerReportingGovernanceId,
        summary: "Consumer reporting governance restrictions are visible for manual review.",
      })
    );
  }
  if (status === "review_required" || status === "partially_ready") {
    canonicalEvents.push(
      event({
        eventType: "consumer_reporting_review_required",
        status,
        consumerReportingGovernanceId,
        summary: "Manual consumer reporting governance review is required.",
      })
    );
  }
  if (status === "blocked") {
    canonicalEvents.push(
      event({
        eventType: "consumer_reporting_blocked",
        status,
        consumerReportingGovernanceId,
        summary: "Consumer reporting governance is blocked by unresolved restrictions.",
      })
    );
  }

  return {
    consumerReportingGovernanceId,
    status,
    manualApprovalRequired: true,
    consumerReportingExecutionEnabled: false,
    autonomousReportingEnabled: false,
    publicReportingExposureEnabled: false,
    generatedAt: generatedAt(input.generatedAt),
    summary: {
      totalReferences: allReferences.length,
      verifiedReferences: allReferences.filter((reference) => reference.status === "verified").length,
      partiallyVerifiedReferences: allReferences.filter((reference) => reference.status === "partially_verified").length,
      blockedReferences: allReferences.filter((reference) => reference.status === "blocked").length,
      unavailableReferences: allReferences.filter((reference) => reference.status === "unavailable").length,
      restrictions: reportingRestrictions.length,
    },
    consentReferences,
    disputeReferences,
    adverseActionReferences,
    credentialingReferences,
    reviewReferences,
    evidenceReferences,
    auditReferences,
    reportingRestrictions,
    redactions: REDACTIONS,
    blockedReasons,
    canonicalEvents,
  };
}
