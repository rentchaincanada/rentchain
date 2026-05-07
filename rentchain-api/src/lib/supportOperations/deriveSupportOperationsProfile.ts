import type {
  DeriveSupportOperationsProfileInput,
  SupportOperationsCanonicalEvent,
  SupportOperationsProfile,
  SupportOperationsStatus,
  SupportReferenceStatus,
  SupportReferenceType,
  SupportOperationsReference,
} from "./supportOperationsTypes";
import { supportOperationsIdPart, supportReference, supportRestriction } from "./supportRestrictionModels";

const DEFAULT_KEY = "production-support-operations-console-v1";

const REDACTIONS = [
  "Sensitive tenant and landlord profile fields, raw screening and credit bureau payloads, payment account details, provider credentials, and admin-only payloads are excluded.",
  "Support operations are visibility metadata only; no autonomous support execution, onboarding intervention, ticket resolution, impersonation, or operational override is enabled.",
  "Public support exposure, uncontrolled messaging, hidden operator actions, and unrestricted admin impersonation payloads are excluded.",
  "Support, evidence, review, incident, and operational-risk lineage remains deterministic, permission scoped, and manually reviewed.",
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

function referenceStatus(record: Record<string, any>, verifiedStatuses: string[]): SupportReferenceStatus {
  const status = asString(record?.status || record?.state || record?.conclusion || record?.severity, 80).toLowerCase();
  if (["blocked", "critical", "major", "failed", "failure", "error", "cancelled"].includes(status)) return "blocked";
  if (verifiedStatuses.includes(status)) return "verified";
  if (["missing", "unknown", "unavailable", "pending"].includes(status)) return "unavailable";
  return "partially_verified";
}

function statusForType(referenceType: SupportReferenceType, record: Record<string, any>): SupportReferenceStatus {
  if (referenceType === "audit" && asString(record?.eventType || record?.type, 120)) return "verified";
  if (referenceType === "review") return referenceStatus(record, ["ready_for_review", "completed", "verified", "reviewed"]);
  if (referenceType === "incident") return referenceStatus(record, ["resolved", "stable", "ready_for_review", "verified"]);
  if (referenceType === "operational_risk") return referenceStatus(record, ["ready_for_review", "verified", "accepted", "resolved"]);
  return referenceStatus(record, ["ready_for_review", "verified", "available", "completed", "stable", "active", "resolved"]);
}

function profileStatus(hasContext: boolean, references: SupportOperationsReference[]): SupportOperationsStatus {
  if (!hasContext) return "unknown";
  if (references.some((reference) => reference.status === "blocked" && (reference.referenceType === "incident" || reference.referenceType === "operational_risk"))) return "blocked";
  const criticalMissing = references.some(
    (reference) =>
      reference.status === "unavailable" &&
      (reference.referenceType === "support" ||
        reference.referenceType === "onboarding" ||
        reference.referenceType === "review" ||
        reference.referenceType === "evidence" ||
        reference.referenceType === "audit")
  );
  if (criticalMissing) return "review_required";
  if (references.some((reference) => reference.status === "blocked" || reference.status === "unavailable" || reference.status === "partially_verified")) return "attention_required";
  return "stable";
}

function event(input: {
  eventType: SupportOperationsCanonicalEvent["eventType"];
  status: SupportOperationsStatus;
  supportOperationsId: string;
  summary: string;
}): SupportOperationsCanonicalEvent {
  return {
    eventType: input.eventType,
    action: input.eventType.replace(/^support_operations_/, "").replace(/_/g, "."),
    status: input.status,
    resourceType: "support_operations_profile",
    resourceId: input.supportOperationsId,
    summary: input.summary,
  };
}

function referencesFor(input: {
  records: Record<string, any>[];
  fallback: string;
  referenceType: SupportReferenceType;
  idKeys: string[];
  label: string;
  description: string;
  destination: string;
  blockedReason: string;
}): SupportOperationsReference[] {
  if (!input.records.length) {
    return [
      supportReference({
        idParts: [input.referenceType, "missing"],
        referenceType: input.referenceType,
        status: "unavailable",
        label: input.label,
        description: `${input.description} is unavailable for support operations review.`,
        destination: input.destination,
      }),
    ];
  }
  return input.records.map((record, index) => {
    const id = recordId(record, input.idKeys) || `${input.fallback}-${index + 1}`;
    const status = statusForType(input.referenceType, record);
    return supportReference({
      idParts: [input.referenceType, id],
      referenceType: input.referenceType,
      status,
      label: input.label,
      description: `${input.description} is available as operational support metadata.`,
      lineageReferences: [id].filter(Boolean),
      destination: input.destination,
      redacted: Boolean(record.redacted),
      redactionReason: record.redacted ? `${input.label} payload is redacted for support operations safety.` : null,
      blockedReason: status === "blocked" ? input.blockedReason : null,
    });
  });
}

export function deriveSupportOperationsProfile(input: DeriveSupportOperationsProfileInput): SupportOperationsProfile {
  const key = asString(input.supportOperationsKey, 160) || DEFAULT_KEY;
  const supportOperationsId = supportOperationsIdPart(["support_operations", key].join(":")) || "support_operations:unknown";

  const supportRecords = asArray(input.supportRecords);
  const onboardingRecords = asArray(input.onboardingRecords);
  const credentialingRecords = asArray(input.credentialingRecords);
  const incidentRecords = asArray(input.incidentRecords);
  const operationalRiskRecords = asArray(input.operationalRiskRecords);
  const reviewRecords = asArray(input.reviewRecords);
  const evidencePacks = asArray(input.evidencePacks);
  const auditEvents = asArray(input.auditEvents);

  const supportReferences = referencesFor({
    records: supportRecords,
    fallback: "support",
    referenceType: "support",
    idKeys: ["supportTicketId", "ticketId", "triageId", "resolutionId", "assignmentId", "slaId", "id"],
    label: "Support ticket lineage reference",
    description: "Support ticket, triage, assignment, escalation, and resolution lineage",
    destination: "/admin/support-operations",
    blockedReason: "Support ticket lineage is blocked.",
  });
  const onboardingReferences = referencesFor({
    records: onboardingRecords,
    fallback: "onboarding",
    referenceType: "onboarding",
    idKeys: ["onboardingHardeningId", "onboardingReadinessId", "onboardingId", "id"],
    label: "Onboarding support reference",
    description: "Onboarding hardening and onboarding support metadata",
    destination: "/onboarding-hardening",
    blockedReason: "Onboarding support lineage is blocked.",
  });
  const credentialingReferences = referencesFor({
    records: credentialingRecords,
    fallback: "credentialing",
    referenceType: "credentialing",
    idKeys: ["platformCredentialingId", "credentialingReadinessId", "id"],
    label: "Credentialing support reference",
    description: "Credentialing readiness and support metadata",
    destination: "/platform-credentialing-readiness",
    blockedReason: "Credentialing support lineage is blocked.",
  });
  const incidentReferences = referencesFor({
    records: incidentRecords,
    fallback: "incident",
    referenceType: "incident",
    idKeys: ["observabilityIncidentReadinessId", "incidentId", "alertId", "id"],
    label: "Incident/support linkage reference",
    description: "Incident linkage and operational recovery metadata",
    destination: "/observability-incident-readiness",
    blockedReason: "Incident or recovery linkage is blocked.",
  });
  const operationalRiskReferences = referencesFor({
    records: operationalRiskRecords,
    fallback: "operational-risk",
    referenceType: "operational_risk",
    idKeys: ["operationalRiskProfileId", "riskId", "alertId", "id"],
    label: "Operational risk support reference",
    description: "Operational risk dependency metadata",
    destination: "/operational-risk",
    blockedReason: "Operational risk dependency blocks support operations.",
  });
  const reviewReferences = referencesFor({
    records: reviewRecords,
    fallback: "review",
    referenceType: "review",
    idKeys: ["reviewSessionId", "operatorReviewId", "id"],
    label: "Support review lineage reference",
    description: "Support review lineage",
    destination: "/review-timeline",
    blockedReason: "Support review lineage is blocked.",
  });
  const evidenceReferences = referencesFor({
    records: evidencePacks,
    fallback: "evidence",
    referenceType: "evidence",
    idKeys: ["evidencePackId", "id"],
    label: "Support evidence lineage reference",
    description: "Support evidence lineage",
    destination: "/evidence-packs",
    blockedReason: "Support evidence lineage is blocked.",
  });
  const auditReferences = referencesFor({
    records: auditEvents.slice(0, 20),
    fallback: "audit",
    referenceType: "audit",
    idKeys: ["eventId", "auditId", "id"],
    label: "Support audit lineage reference",
    description: "Support audit lineage",
    destination: "/review-timeline",
    blockedReason: "Support audit lineage is blocked.",
  });

  const allReferences = [
    ...supportReferences,
    ...onboardingReferences,
    ...credentialingReferences,
    ...incidentReferences,
    ...operationalRiskReferences,
    ...reviewReferences,
    ...evidenceReferences,
    ...auditReferences,
  ];
  const hasContext = Boolean(
    supportRecords.length ||
      onboardingRecords.length ||
      credentialingRecords.length ||
      incidentRecords.length ||
      operationalRiskRecords.length ||
      reviewRecords.length ||
      evidencePacks.length ||
      auditEvents.length
  );
  const status = profileStatus(hasContext, allReferences);
  const supportRestrictions = allReferences
    .filter((reference) => reference.status !== "verified")
    .map((reference) =>
      supportRestriction({
        idParts: [reference.referenceType, reference.referenceId],
        restrictionType: reference.referenceType,
        status: reference.status === "blocked" ? "blocked" : "review_required",
        label: `${reference.label} restriction`,
        description: `${reference.label} is incomplete or blocked for support operations review.`,
        blockedReason: reference.blockedReason,
      })
    );
  const blockedReasons = [...allReferences.map((reference) => reference.blockedReason), ...supportRestrictions.map((restriction) => restriction.blockedReason)].filter(Boolean) as string[];

  const canonicalEvents: SupportOperationsCanonicalEvent[] = [
    event({
      eventType: "support_operations_profile_derived",
      status,
      supportOperationsId,
      summary: "Support operations profile derived from support, onboarding, credentialing, incident, operational-risk, review, evidence, and audit metadata.",
    }),
    event({
      eventType: "support_operations_redaction_applied",
      status,
      supportOperationsId,
      summary: "Sensitive tenant, landlord, screening, payment, provider credential, admin-only, impersonation, override, public exposure, and autonomous execution payloads were excluded.",
    }),
  ];
  if (supportRestrictions.length) {
    canonicalEvents.push(event({ eventType: "support_operations_restriction_detected", status, supportOperationsId, summary: "Support operations restrictions are visible for manual review." }));
  }
  if (status === "review_required" || status === "attention_required") {
    canonicalEvents.push(event({ eventType: "support_operations_review_required", status, supportOperationsId, summary: "Manual support operations review is required." }));
  }
  if (status === "blocked") {
    canonicalEvents.push(event({ eventType: "support_operations_blocked", status, supportOperationsId, summary: "Support operations profile is blocked by unresolved restrictions." }));
  }

  return {
    supportOperationsId,
    status,
    manualReviewRequired: true,
    autonomousSupportExecutionEnabled: false,
    adminImpersonationEnabled: false,
    generatedAt: generatedAt(input.generatedAt),
    summary: {
      totalReferences: allReferences.length,
      verifiedReferences: allReferences.filter((reference) => reference.status === "verified").length,
      partiallyVerifiedReferences: allReferences.filter((reference) => reference.status === "partially_verified").length,
      blockedReferences: allReferences.filter((reference) => reference.status === "blocked").length,
      unavailableReferences: allReferences.filter((reference) => reference.status === "unavailable").length,
      restrictions: supportRestrictions.length,
    },
    supportReferences,
    onboardingReferences,
    credentialingReferences,
    incidentReferences,
    operationalRiskReferences,
    reviewReferences,
    evidenceReferences,
    auditReferences,
    supportRestrictions,
    redactions: REDACTIONS,
    blockedReasons,
    canonicalEvents,
  };
}
