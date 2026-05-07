import type {
  DeriveTenantParticipationProfileInput,
  ParticipationReference,
  ParticipationReferenceStatus,
  ParticipationReferenceType,
  TenantParticipationCanonicalEvent,
  TenantParticipationProfile,
  TenantParticipationStatus,
} from "./tenantParticipationTypes";
import { participationIdPart, participationReference, participationRestriction } from "./participationRestrictionModels";

const REDACTIONS = [
  "Public-facing tenant scoring outputs, ranking outputs, social-credit indicators, and public reputation marketplace payloads are excluded.",
  "Raw payment account details, raw screening or credit bureau payloads, private tenant documents, and unrestricted audit histories are excluded.",
  "Tenant participation is visibility metadata only; no autonomous rewards, penalties, public profiles, or hidden behavioral scoring are enabled.",
  "Participation references are consent-aware, permission scoped, and manually reviewed before any portable use.",
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

function referenceStatus(record: Record<string, any>, verifiedStatuses: string[]): ParticipationReferenceStatus {
  const status = asString(record?.status || record?.state || record?.conclusion, 80).toLowerCase();
  if (status === "blocked" || status === "elevated" || status === "failure" || status === "failed" || status === "error" || status === "cancelled") return "blocked";
  if (verifiedStatuses.includes(status)) return "verified";
  if (status === "missing" || status === "unknown" || status === "unavailable" || status === "pending") return "unavailable";
  return "partially_verified";
}

function statusForType(referenceType: ParticipationReferenceType, record: Record<string, any>): ParticipationReferenceStatus {
  if (referenceType === "review") return referenceStatus(record, ["ready_for_review", "completed", "verified"]);
  if (referenceType === "audit" && asString(record?.eventType, 120)) return "verified";
  return referenceStatus(record, ["ready_for_review", "verified", "available", "completed", "stable", "active"]);
}

function profileStatus(hasContext: boolean, references: ParticipationReference[]): TenantParticipationStatus {
  if (!hasContext) return "unknown";
  if (references.some((reference) => reference.status === "blocked" && (reference.referenceType === "onboarding" || reference.referenceType === "dispute_resolution"))) return "blocked";
  const criticalMissing = references.some(
    (reference) =>
      reference.status === "unavailable" &&
      (reference.referenceType === "onboarding" ||
        reference.referenceType === "review" ||
        reference.referenceType === "evidence" ||
        reference.referenceType === "audit")
  );
  if (criticalMissing) return "review_required";
  if (references.some((reference) => reference.status === "blocked" || reference.status === "unavailable" || reference.status === "partially_verified")) return "partially_verified";
  return "verified";
}

function event(input: {
  eventType: TenantParticipationCanonicalEvent["eventType"];
  status: TenantParticipationStatus;
  tenantParticipationId: string;
  summary: string;
}): TenantParticipationCanonicalEvent {
  return {
    eventType: input.eventType,
    action: input.eventType.replace(/^tenant_participation_/, "").replace(/_/g, "."),
    status: input.status,
    resourceType: "tenant_participation_profile",
    resourceId: input.tenantParticipationId,
    summary: input.summary,
  };
}

function referencesFor(input: {
  records: Record<string, any>[];
  fallback: string;
  referenceType: ParticipationReferenceType;
  idKeys: string[];
  label: string;
  description: string;
  destination: string;
  blockedReason: string;
}): ParticipationReference[] {
  if (!input.records.length) {
    return [
      participationReference({
        idParts: [input.referenceType, "missing"],
        referenceType: input.referenceType,
        status: "unavailable",
        label: input.label,
        description: `${input.description} is unavailable for participation review.`,
        destination: input.destination,
      }),
    ];
  }
  return input.records.map((record, index) => {
    const id = recordId(record, input.idKeys) || `${input.fallback}-${index + 1}`;
    const status = statusForType(input.referenceType, record);
    return participationReference({
      idParts: [input.referenceType, id],
      referenceType: input.referenceType,
      status,
      label: input.label,
      description: `${input.description} is available for participation review.`,
      lineageReferences: [id].filter(Boolean),
      destination: input.destination,
      redacted: Boolean(record.redacted),
      redactionReason: record.redacted ? `${input.label} payload is redacted for tenant participation safety.` : null,
      blockedReason: status === "blocked" ? input.blockedReason : null,
    });
  });
}

export function deriveTenantParticipationProfile(input: DeriveTenantParticipationProfileInput): TenantParticipationProfile {
  const tenantId = asString(input.tenantId, 240) || "unknown";
  const tenantParticipationId = participationIdPart(["tenant_participation", tenantId].join(":")) || "tenant_participation:unknown";

  const onboardingRecords = asArray(input.onboardingRecords);
  const paymentConsistencyRecords = asArray(input.paymentConsistencyRecords);
  const occupancyRecords = asArray(input.occupancyRecords);
  const maintenanceRecords = asArray(input.maintenanceRecords);
  const reviewRecords = asArray(input.reviewRecords);
  const disputeRecords = asArray(input.disputeRecords);
  const communicationRecords = asArray(input.communicationRecords);
  const evidencePacks = asArray(input.evidencePacks);
  const auditEvents = asArray(input.auditEvents);

  const onboardingReferences = referencesFor({
    records: onboardingRecords,
    fallback: "onboarding",
    referenceType: "onboarding",
    idKeys: ["onboardingId", "applicationId", "tenantId", "id"],
    label: "Onboarding participation reference",
    description: "Tenant onboarding participation metadata",
    destination: "/tenant/application",
    blockedReason: "Onboarding participation is blocked.",
  });
  const paymentConsistencyReferences = referencesFor({
    records: paymentConsistencyRecords,
    fallback: "payment",
    referenceType: "payment_consistency",
    idKeys: ["paymentConsistencyId", "ledgerEventId", "paymentId", "id"],
    label: "Payment-consistency reference",
    description: "Verified payment-consistency metadata",
    destination: "/tenant/ledger",
    blockedReason: "Payment-consistency reference is blocked.",
  });
  const occupancyReferences = referencesFor({
    records: occupancyRecords,
    fallback: "occupancy",
    referenceType: "occupancy",
    idKeys: ["rentalHistoryLedgerId", "leaseId", "occupancyId", "id"],
    label: "Occupancy-consistency reference",
    description: "Verified occupancy-consistency metadata",
    destination: "/tenant/lease",
    blockedReason: "Occupancy-consistency reference is blocked.",
  });
  const maintenanceParticipationReferences = referencesFor({
    records: maintenanceRecords,
    fallback: "maintenance",
    referenceType: "maintenance",
    idKeys: ["maintenanceRequestId", "workOrderId", "id"],
    label: "Maintenance participation reference",
    description: "Maintenance participation metadata",
    destination: "/tenant/maintenance",
    blockedReason: "Maintenance participation reference is blocked.",
  });
  const reviewParticipationReferences = referencesFor({
    records: reviewRecords,
    fallback: "review",
    referenceType: "review",
    idKeys: ["reviewSessionId", "operatorReviewId", "id"],
    label: "Review participation reference",
    description: "Manual review participation metadata",
    destination: "/review-timeline",
    blockedReason: "Review participation reference is blocked.",
  });
  const disputeParticipationReferences = referencesFor({
    records: disputeRecords,
    fallback: "dispute",
    referenceType: "dispute_resolution",
    idKeys: ["disputeResolutionId", "disputeId", "caseId", "id"],
    label: "Dispute-resolution participation reference",
    description: "Dispute-resolution participation metadata",
    destination: "/tenant/activity",
    blockedReason: "Dispute-resolution participation is blocked.",
  });
  const communicationParticipationReferences = referencesFor({
    records: communicationRecords,
    fallback: "communication",
    referenceType: "communication",
    idKeys: ["communicationId", "messageId", "noticeId", "id"],
    label: "Communication responsiveness reference",
    description: "Communication responsiveness metadata",
    destination: "/tenant/messages",
    blockedReason: "Communication responsiveness reference is blocked.",
  });
  const evidenceReferences = referencesFor({
    records: evidencePacks,
    fallback: "evidence",
    referenceType: "evidence",
    idKeys: ["evidencePackId", "id"],
    label: "Participation evidence lineage reference",
    description: "Participation evidence lineage metadata",
    destination: "/evidence-packs",
    blockedReason: "Participation evidence lineage is blocked.",
  });
  const auditReferences = referencesFor({
    records: auditEvents.slice(0, 20),
    fallback: "audit",
    referenceType: "audit",
    idKeys: ["eventId", "auditId", "id"],
    label: "Participation audit lineage reference",
    description: "Participation audit lineage metadata",
    destination: "/tenant/activity",
    blockedReason: "Participation audit lineage is blocked.",
  });

  const allReferences = [
    ...onboardingReferences,
    ...paymentConsistencyReferences,
    ...occupancyReferences,
    ...maintenanceParticipationReferences,
    ...reviewParticipationReferences,
    ...disputeParticipationReferences,
    ...communicationParticipationReferences,
    ...evidenceReferences,
    ...auditReferences,
  ];
  const hasContext = Boolean(
    onboardingRecords.length ||
      paymentConsistencyRecords.length ||
      occupancyRecords.length ||
      maintenanceRecords.length ||
      reviewRecords.length ||
      disputeRecords.length ||
      communicationRecords.length ||
      evidencePacks.length ||
      auditEvents.length
  );
  const status = profileStatus(hasContext, allReferences);
  const participationRestrictions = allReferences
    .filter((reference) => reference.status !== "verified")
    .map((reference) =>
      participationRestriction({
        idParts: [reference.referenceType, reference.referenceId],
        restrictionType: reference.referenceType,
        status: reference.status === "blocked" ? "blocked" : "review_required",
        label: `${reference.label} restriction`,
        description: `${reference.label} is incomplete or blocked for tenant participation review.`,
        blockedReason: reference.blockedReason,
      })
    );
  const blockedReasons = [...allReferences.map((reference) => reference.blockedReason), ...participationRestrictions.map((restriction) => restriction.blockedReason)].filter(Boolean) as string[];

  const canonicalEvents: TenantParticipationCanonicalEvent[] = [
    event({
      eventType: "tenant_participation_profile_derived",
      status,
      tenantParticipationId,
      summary:
        "Tenant participation profile derived from onboarding, payment, occupancy, maintenance, review, dispute, communication, evidence, and audit metadata.",
    }),
    event({
      eventType: "tenant_participation_redaction_applied",
      status,
      tenantParticipationId,
      summary:
        "Public scoring, public ranking, raw payment, raw screening, private tenant document, and unrestricted audit payloads were excluded.",
    }),
  ];
  if (participationRestrictions.length) {
    canonicalEvents.push(
      event({
        eventType: "tenant_participation_restriction_detected",
        status,
        tenantParticipationId,
        summary: "Tenant participation restrictions are visible for manual review.",
      })
    );
  }
  if (status === "review_required" || status === "partially_verified") {
    canonicalEvents.push(
      event({
        eventType: "tenant_participation_review_required",
        status,
        tenantParticipationId,
        summary: "Manual tenant participation review is required.",
      })
    );
  }
  if (status === "blocked") {
    canonicalEvents.push(
      event({
        eventType: "tenant_participation_blocked",
        status,
        tenantParticipationId,
        summary: "Tenant participation profile is blocked by unresolved restrictions.",
      })
    );
  }

  return {
    tenantParticipationId,
    status,
    tenantId,
    manualReviewRequired: true,
    publicParticipationExposureEnabled: false,
    autonomousRewardExecutionEnabled: false,
    generatedAt: generatedAt(input.generatedAt),
    summary: {
      totalReferences: allReferences.length,
      verifiedReferences: allReferences.filter((reference) => reference.status === "verified").length,
      partiallyVerifiedReferences: allReferences.filter((reference) => reference.status === "partially_verified").length,
      blockedReferences: allReferences.filter((reference) => reference.status === "blocked").length,
      unavailableReferences: allReferences.filter((reference) => reference.status === "unavailable").length,
      restrictions: participationRestrictions.length,
    },
    onboardingReferences,
    paymentConsistencyReferences,
    occupancyReferences,
    maintenanceParticipationReferences,
    reviewParticipationReferences,
    disputeParticipationReferences,
    communicationParticipationReferences,
    evidenceReferences,
    auditReferences,
    participationRestrictions,
    redactions: REDACTIONS,
    blockedReasons,
    canonicalEvents,
  };
}
