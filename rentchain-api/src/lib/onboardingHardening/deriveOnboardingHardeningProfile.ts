import type {
  DeriveOnboardingHardeningProfileInput,
  OnboardingCanonicalEvent,
  OnboardingHardeningProfile,
  OnboardingHardeningStatus,
  OnboardingParticipantType,
  OnboardingReference,
  OnboardingReferenceStatus,
  OnboardingReferenceType,
} from "./onboardingHardeningTypes";
import { onboardingHardeningIdPart, onboardingReference, onboardingRestriction } from "./onboardingRestrictionModels";

const REDACTIONS = [
  "Sensitive tenant and landlord profile fields, private documents, raw government identifiers, and admin-only onboarding payloads are excluded.",
  "Raw screening, credit bureau, payment account, and provider credential payloads are excluded.",
  "Onboarding hardening is visibility metadata only; no autonomous onboarding, screening activation, integration activation, or onboarding messaging is enabled.",
  "Onboarding readiness references are deterministic, permission scoped, evidence backed, and manually reviewed.",
  "Hidden onboarding scores, probabilistic rankings, public onboarding profiles, and unrestricted onboarding exposure are excluded.",
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

function participantType(value: unknown): OnboardingParticipantType {
  return asString(value, 80).toLowerCase() === "tenant" ? "tenant" : "landlord";
}

function recordId(record: Record<string, any>, keys: string[]): string {
  for (const key of keys) {
    const value = asString(record?.[key], 240);
    if (value) return value;
  }
  return asString(record?.id, 240);
}

function referenceStatus(record: Record<string, any>, verifiedStatuses: string[]): OnboardingReferenceStatus {
  const status = asString(record?.status || record?.state || record?.conclusion || record?.recordStatus, 80).toLowerCase();
  if (status === "blocked" || status === "restricted" || status === "failed" || status === "failure" || status === "error" || status === "cancelled") return "blocked";
  if (verifiedStatuses.includes(status)) return "verified";
  if (status === "missing" || status === "unknown" || status === "unavailable" || status === "pending") return "unavailable";
  return "partially_verified";
}

function statusForType(referenceType: OnboardingReferenceType, record: Record<string, any>): OnboardingReferenceStatus {
  if (referenceType === "audit" && asString(record?.eventType || record?.type, 120)) return "verified";
  if (referenceType === "review") return referenceStatus(record, ["ready_for_review", "completed", "verified", "reviewed"]);
  if (referenceType === "friction") return referenceStatus(record, ["resolved", "reviewed", "verified", "completed"]);
  return referenceStatus(record, ["ready_for_review", "verified", "available", "completed", "stable", "active", "configured", "done"]);
}

function profileStatus(hasContext: boolean, references: OnboardingReference[]): OnboardingHardeningStatus {
  if (!hasContext) return "unknown";
  if (references.some((reference) => reference.status === "blocked" && (reference.referenceType === "completion" || reference.referenceType === "profile"))) return "blocked";
  const criticalMissing = references.some(
    (reference) =>
      reference.status === "unavailable" &&
      (reference.referenceType === "completion" ||
        reference.referenceType === "profile" ||
        reference.referenceType === "review" ||
        reference.referenceType === "evidence" ||
        reference.referenceType === "audit")
  );
  if (criticalMissing) return "review_required";
  if (references.some((reference) => reference.status === "blocked" || reference.status === "unavailable" || reference.status === "partially_verified")) return "partially_ready";
  return "ready_for_review";
}

function event(input: {
  eventType: OnboardingCanonicalEvent["eventType"];
  status: OnboardingHardeningStatus;
  onboardingHardeningId: string;
  summary: string;
}): OnboardingCanonicalEvent {
  return {
    eventType: input.eventType,
    action: input.eventType.replace(/^onboarding_hardening_/, "").replace(/_/g, "."),
    status: input.status,
    resourceType: "onboarding_hardening_profile",
    resourceId: input.onboardingHardeningId,
    summary: input.summary,
  };
}

function referencesFor(input: {
  records: Record<string, any>[];
  fallback: string;
  referenceType: OnboardingReferenceType;
  idKeys: string[];
  label: string;
  description: string;
  destination: string;
  blockedReason: string;
}): OnboardingReference[] {
  if (!input.records.length) {
    return [
      onboardingReference({
        idParts: [input.referenceType, "missing"],
        referenceType: input.referenceType,
        status: "unavailable",
        label: input.label,
        description: `${input.description} is unavailable for onboarding hardening review.`,
        destination: input.destination,
      }),
    ];
  }
  return input.records.map((record, index) => {
    const id = recordId(record, input.idKeys) || `${input.fallback}-${index + 1}`;
    const status = statusForType(input.referenceType, record);
    return onboardingReference({
      idParts: [input.referenceType, id],
      referenceType: input.referenceType,
      status,
      label: input.label,
      description: `${input.description} is available as operational onboarding hardening metadata.`,
      lineageReferences: [id].filter(Boolean),
      destination: input.destination,
      redacted: Boolean(record.redacted),
      redactionReason: record.redacted ? `${input.label} payload is redacted for onboarding hardening safety.` : null,
      blockedReason: status === "blocked" ? input.blockedReason : null,
    });
  });
}

export function deriveOnboardingHardeningProfile(input: DeriveOnboardingHardeningProfileInput): OnboardingHardeningProfile {
  const type = participantType(input.participantType);
  const participantId = asString(input.participantId, 240) || "unknown";
  const onboardingHardeningId =
    onboardingHardeningIdPart(["onboarding_hardening", type, participantId].join(":")) || "onboarding_hardening:unknown";

  const completionRecords = asArray(input.completionRecords);
  const profileRecords = asArray(input.profileRecords);
  const screeningReadinessRecords = asArray(input.screeningReadinessRecords);
  const integrationReadinessRecords = asArray(input.integrationReadinessRecords);
  const frictionRecords = asArray(input.frictionRecords);
  const reviewRecords = asArray(input.reviewRecords);
  const evidencePacks = asArray(input.evidencePacks);
  const auditEvents = asArray(input.auditEvents);

  const completionReferences = referencesFor({
    records: completionRecords,
    fallback: "completion",
    referenceType: "completion",
    idKeys: ["onboardingHardeningId", "onboardingId", "applicationId", "inviteId", "stepId", "id"],
    label: "Onboarding completion reference",
    description: `${type} onboarding completion lineage`,
    destination: type === "tenant" ? "/tenant/application" : "/dashboard",
    blockedReason: "Onboarding completion lineage is blocked.",
  });
  const profileReferences = referencesFor({
    records: profileRecords,
    fallback: "profile",
    referenceType: "profile",
    idKeys: ["profileReadinessId", "profileId", "tenantId", "landlordId", "id"],
    label: "Profile readiness reference",
    description: `${type} profile completeness lineage`,
    destination: type === "tenant" ? "/tenant/profile" : "/account",
    blockedReason: "Profile readiness lineage is blocked.",
  });
  const screeningReadinessReferences = referencesFor({
    records: screeningReadinessRecords,
    fallback: "screening",
    referenceType: "screening",
    idKeys: ["screeningReadinessId", "screeningOrderId", "integrationId", "applicationId", "id"],
    label: "Screening readiness reference",
    description: "Screening setup readiness metadata",
    destination: type === "tenant" ? "/tenant/screening" : "/screening",
    blockedReason: "Screening readiness is blocked.",
  });
  const integrationReadinessReferences = referencesFor({
    records: integrationReadinessRecords,
    fallback: "integration",
    referenceType: "integration",
    idKeys: ["integrationReadinessId", "integrationId", "adapterId", "connectionId", "id"],
    label: "Integration readiness reference",
    description: "Integration setup readiness metadata",
    destination: type === "tenant" ? "/tenant/access" : "/interoperability-adapters",
    blockedReason: "Integration readiness is blocked.",
  });
  const frictionReferences = referencesFor({
    records: frictionRecords,
    fallback: "friction",
    referenceType: "friction",
    idKeys: ["frictionId", "alertId", "eventId", "id"],
    label: "Onboarding friction reference",
    description: "Onboarding recovery and friction metadata",
    destination: type === "tenant" ? "/tenant/onboarding-hardening" : "/onboarding-hardening",
    blockedReason: "Onboarding friction requires review.",
  });
  const reviewReferences = referencesFor({
    records: reviewRecords,
    fallback: "review",
    referenceType: "review",
    idKeys: ["reviewSessionId", "operatorReviewId", "id"],
    label: "Onboarding review lineage reference",
    description: "Onboarding review lineage",
    destination: "/review-timeline",
    blockedReason: "Onboarding review lineage is blocked.",
  });
  const evidenceReferences = referencesFor({
    records: evidencePacks,
    fallback: "evidence",
    referenceType: "evidence",
    idKeys: ["evidencePackId", "id"],
    label: "Onboarding evidence lineage reference",
    description: "Onboarding evidence lineage",
    destination: "/evidence-packs",
    blockedReason: "Onboarding evidence lineage is blocked.",
  });
  const auditReferences = referencesFor({
    records: auditEvents.slice(0, 20),
    fallback: "audit",
    referenceType: "audit",
    idKeys: ["eventId", "auditId", "id"],
    label: "Onboarding audit lineage reference",
    description: "Onboarding audit lineage",
    destination: type === "tenant" ? "/tenant/activity" : "/review-timeline",
    blockedReason: "Onboarding audit lineage is blocked.",
  });

  const allReferences = [
    ...completionReferences,
    ...profileReferences,
    ...screeningReadinessReferences,
    ...integrationReadinessReferences,
    ...frictionReferences,
    ...reviewReferences,
    ...evidenceReferences,
    ...auditReferences,
  ];
  const hasContext = Boolean(
    completionRecords.length ||
      profileRecords.length ||
      screeningReadinessRecords.length ||
      integrationReadinessRecords.length ||
      frictionRecords.length ||
      reviewRecords.length ||
      evidencePacks.length ||
      auditEvents.length
  );
  const status = profileStatus(hasContext, allReferences);
  const onboardingRestrictions = allReferences
    .filter((reference) => reference.status !== "verified")
    .map((reference) =>
      onboardingRestriction({
        idParts: [reference.referenceType, reference.referenceId],
        restrictionType: reference.referenceType,
        status: reference.status === "blocked" ? "blocked" : "review_required",
        label: `${reference.label} restriction`,
        description: `${reference.label} is incomplete or blocked for onboarding hardening review.`,
        blockedReason: reference.blockedReason,
      })
    );
  const blockedReasons = [...allReferences.map((reference) => reference.blockedReason), ...onboardingRestrictions.map((restriction) => restriction.blockedReason)].filter(Boolean) as string[];

  const canonicalEvents: OnboardingCanonicalEvent[] = [
    event({
      eventType: "onboarding_hardening_profile_derived",
      status,
      onboardingHardeningId,
      summary: "Onboarding hardening profile derived from completion, profile, screening, integration, friction, review, evidence, and audit metadata.",
    }),
    event({
      eventType: "onboarding_hardening_redaction_applied",
      status,
      onboardingHardeningId,
      summary: "Sensitive profile, screening, payment, provider credential, admin-only, hidden scoring, public exposure, and autonomous execution payloads were excluded.",
    }),
  ];
  if (onboardingRestrictions.length) {
    canonicalEvents.push(
      event({
        eventType: "onboarding_hardening_restriction_detected",
        status,
        onboardingHardeningId,
        summary: "Onboarding hardening restrictions are visible for manual review.",
      })
    );
  }
  if (status === "review_required" || status === "partially_ready") {
    canonicalEvents.push(
      event({
        eventType: "onboarding_hardening_review_required",
        status,
        onboardingHardeningId,
        summary: "Manual onboarding hardening review is required.",
      })
    );
  }
  if (status === "blocked") {
    canonicalEvents.push(
      event({
        eventType: "onboarding_hardening_blocked",
        status,
        onboardingHardeningId,
        summary: "Onboarding hardening profile is blocked by unresolved restrictions.",
      })
    );
  }

  return {
    onboardingHardeningId,
    participantType: type,
    participantId,
    status,
    manualReviewRequired: true,
    autonomousOnboardingEnabled: false,
    autonomousScreeningActivationEnabled: false,
    generatedAt: generatedAt(input.generatedAt),
    summary: {
      totalReferences: allReferences.length,
      verifiedReferences: allReferences.filter((reference) => reference.status === "verified").length,
      partiallyVerifiedReferences: allReferences.filter((reference) => reference.status === "partially_verified").length,
      blockedReferences: allReferences.filter((reference) => reference.status === "blocked").length,
      unavailableReferences: allReferences.filter((reference) => reference.status === "unavailable").length,
      restrictions: onboardingRestrictions.length,
    },
    completionReferences,
    profileReferences,
    screeningReadinessReferences,
    integrationReadinessReferences,
    frictionReferences,
    reviewReferences,
    evidenceReferences,
    auditReferences,
    onboardingRestrictions,
    redactions: REDACTIONS.map((redaction) => `${type} ${redaction.charAt(0).toLowerCase()}${redaction.slice(1)}`),
    blockedReasons,
    canonicalEvents,
  };
}
