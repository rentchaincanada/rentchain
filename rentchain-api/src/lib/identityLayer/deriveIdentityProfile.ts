import type {
  DeriveIdentityProfileInput,
  IdentityLayerCanonicalEvent,
  IdentityLayerProfile,
  IdentityLayerReference,
  IdentityLayerStatus,
  IdentityLayerType,
} from "./identityLayerTypes";
import { deriveAccountTrustState, verificationSignal, type VerificationSignal } from "../accountTrust";
import { consentReference } from "./identityConsentModels";
import { identityReference, isVerifiedReference } from "./identityVerificationModels";

const IDENTITY_TYPES = new Set<IdentityLayerType>(["tenant", "property", "organization", "operator", "review_actor"]);

const REDACTIONS = [
  "Government identity numbers are excluded.",
  "Raw screening and credit bureau payloads are excluded.",
  "Payment account details are excluded.",
  "Private tenant documents are excluded.",
];

function asString(value: unknown, max = 240): string {
  return String(value ?? "").trim().slice(0, max);
}

function requestedIdentityType(value: unknown): IdentityLayerType {
  const raw = asString(value, 80) as IdentityLayerType;
  return IDENTITY_TYPES.has(raw) ? raw : "tenant";
}

function safeIdentityId(type: IdentityLayerType, value: unknown) {
  const raw = asString(value, 400);
  return raw ? `${type}:${raw}` : `${type}:unknown`;
}

function hasValue(record: Record<string, unknown> | null | undefined, keys: string[]) {
  return keys.some((key) => asString(record?.[key], 400));
}

function statusFromReferences(params: {
  sourceAvailable: boolean;
  verificationReferences: IdentityLayerReference[];
  consentReferences: IdentityLayerReference[];
  blockedReasons: string[];
}): IdentityLayerStatus {
  if (!params.sourceAvailable) return "unknown";
  if (params.blockedReasons.length) return "blocked";

  const verifiedCount = params.verificationReferences.filter(isVerifiedReference).length;
  const missingVerification = params.verificationReferences.some((reference) => reference.status === "missing");
  const missingConsent = params.consentReferences.length === 0;

  if (verifiedCount > 0 && !missingVerification && !missingConsent) return "verified";
  if (verifiedCount > 0) return "partially_verified";
  return "review_required";
}

function canonicalEvent(params: {
  eventType: IdentityLayerCanonicalEvent["eventType"];
  status: IdentityLayerStatus;
  resourceType: IdentityLayerType;
  resourceId: string;
  summary: string;
}): IdentityLayerCanonicalEvent {
  return {
    eventType: params.eventType,
    action: params.eventType.replace(/^identity_/, "").replace(/_/g, "."),
    status: params.status,
    resourceType: params.resourceType,
    resourceId: params.resourceId,
    summary: params.summary,
  };
}

function trustSubjectType(identityType: IdentityLayerType) {
  if (identityType === "property") return "property" as const;
  if (identityType === "organization") return "organization" as const;
  if (identityType === "operator" || identityType === "review_actor") return "operator" as const;
  return "tenant" as const;
}

function trustSignals(params: {
  identityType: IdentityLayerType;
  identityId: string;
  sourceRecord: Record<string, unknown> | null | undefined;
  verificationReferences: IdentityLayerReference[];
  reviewReferences: IdentityLayerReference[];
}): VerificationSignal[] {
  const subjectType = trustSubjectType(params.identityType);
  const subjectId = params.identityId.replace(/^[^:]+:/, "") || "unknown";
  const signals: VerificationSignal[] = [];
  const source = params.sourceRecord || null;

  if (hasValue(source, ["email", "emailVerifiedAt"]) || source?.emailVerified === true) {
    signals.push(
      verificationSignal({
        signalType: "email",
        subjectType,
        subjectId,
        status: source?.emailVerified === true || hasValue(source, ["emailVerifiedAt"]) ? "verified" : "asserted",
        source: source?.emailVerified === true || hasValue(source, ["emailVerifiedAt"]) ? "email_verification" : "self_asserted",
        evidenceType: "metadata_only",
        verifiedAt: source?.emailVerifiedAt,
      })
    );
  }
  if (hasValue(source, ["phone", "applicantPhone", "phoneVerifiedAt"]) || source?.phoneVerified === true) {
    signals.push(
      verificationSignal({
        signalType: "phone",
        subjectType,
        subjectId,
        status: source?.phoneVerified === true || hasValue(source, ["phoneVerifiedAt"]) ? "verified" : "asserted",
        source: source?.phoneVerified === true || hasValue(source, ["phoneVerifiedAt"]) ? "phone_otp" : "self_asserted",
        evidenceType: "metadata_only",
        verifiedAt: source?.phoneVerifiedAt,
      })
    );
  }

  for (const reference of params.verificationReferences) {
    if (reference.status !== "available" || reference.redacted) continue;
    if (reference.referenceType === "screening") {
      signals.push(
        verificationSignal({
          signalType: "screening",
          subjectType,
          subjectId,
          status: "verified",
          source: "screening_workflow",
          evidenceType: "screening_order",
          confidence: "medium",
          evidenceRef: reference.referenceId,
          verifiedAt: reference.occurredAt,
        })
      );
    }
    if (reference.referenceType === "property_registry") {
      signals.push(
        verificationSignal({
          signalType: "property",
          subjectType,
          subjectId,
          status: "verified",
          source: "public_registry",
          evidenceType: "registry_record",
          confidence: "high",
          providerKey: "public_registry",
          evidenceRef: reference.referenceId,
          verifiedAt: reference.occurredAt,
        })
      );
    }
    if (reference.referenceType === "tenant_profile" || reference.referenceType === "organization") {
      signals.push(
        verificationSignal({
          signalType: "identity",
          subjectType,
          subjectId,
          status: "asserted",
          source: "self_asserted",
          evidenceType: "metadata_only",
          evidenceRef: reference.referenceId,
          issuedAt: reference.occurredAt,
        })
      );
    }
  }

  for (const reference of params.reviewReferences) {
    if (reference.status !== "available" || reference.redacted) continue;
    signals.push(
      verificationSignal({
        signalType: "institution",
        subjectType,
        subjectId,
        status: "verified",
        source: "operator_review",
        evidenceType: "manual_review",
        confidence: "medium",
        evidenceRef: reference.referenceId,
        verifiedAt: reference.occurredAt,
        reviewRequired: true,
      })
    );
  }

  if (hasValue(source, ["identityVerificationId"]) || asString(source?.identityVerificationStatus, 80) === "pending") {
    signals.push(
      verificationSignal({
        signalType: "identity",
        subjectType,
        subjectId,
        status: "pending",
        source: "future_identity_provider",
        evidenceType: "metadata_only",
        confidence: "low",
        reviewRequired: true,
      })
    );
  }

  return signals;
}

function tenantReferences(input: DeriveIdentityProfileInput) {
  const tenant = input.tenant || null;
  const references: IdentityLayerReference[] = [];
  if (tenant) {
    references.push(
      identityReference({
        referenceId: tenant.id || tenant.tenantId || input.identityId,
        referenceType: "tenant_profile",
        label: "Tenant profile reference",
        destination: "/tenants",
        occurredAt: tenant.updatedAt || tenant.createdAt,
      })
    );
  } else {
    references.push(
      identityReference({
        referenceId: "tenant_profile:missing",
        referenceType: "tenant_profile",
        label: "Tenant profile reference",
        status: "missing",
        blockedReason: "Tenant profile context is unavailable.",
      })
    );
  }

  const screeningPresent = hasValue(tenant, ["screeningId", "screeningReportId", "verificationId", "identityVerificationId"]);
  references.push(
    identityReference({
      referenceId: screeningPresent ? tenant?.screeningId || tenant?.screeningReportId || tenant?.verificationId : "screening:missing",
      referenceType: "screening",
      label: "Screening verification reference",
      status: screeningPresent ? "available" : "missing",
      blockedReason: screeningPresent ? null : "Screening verification reference is missing.",
    })
  );

  return references;
}

function propertyReferences(input: DeriveIdentityProfileInput) {
  const property = input.property || null;
  const registry = input.registryStatus || null;
  const references: IdentityLayerReference[] = [];
  if (property) {
    references.push(
      identityReference({
        referenceId: property.id || property.propertyId || input.identityId,
        referenceType: "property_registry",
        label: "Property identity reference",
        destination: "/properties",
        occurredAt: property.updatedAt || property.createdAt,
      })
    );
  } else {
    references.push(
      identityReference({
        referenceId: "property:missing",
        referenceType: "property_registry",
        label: "Property identity reference",
        status: "missing",
        blockedReason: "Property context is unavailable.",
      })
    );
  }

  const verified = ["verified", "matched", "canonical"].includes(asString(registry?.status || registry?.reviewStatus, 80));
  references.push(
    identityReference({
      referenceId: registry?.id || registry?.propertyId || property?.id || "registry:missing",
      referenceType: "property_registry",
      label: "Registry verification reference",
      status: verified ? "available" : "missing",
      occurredAt: registry?.updatedAt || registry?.verifiedAt,
      blockedReason: verified ? null : "Verified registry linkage is missing.",
    })
  );

  return references;
}

function organizationReferences(input: DeriveIdentityProfileInput) {
  const organization = input.organization || null;
  return [
    identityReference({
      referenceId: organization?.id || organization?.organizationId || input.identityId || "organization:missing",
      referenceType: "organization",
      label: "Organization identity reference",
      status: organization ? "available" : "missing",
      blockedReason: organization ? null : "Organization context is unavailable.",
    }),
  ];
}

function operatorReferences(input: DeriveIdentityProfileInput) {
  const operator = input.operator || null;
  return [
    identityReference({
      referenceId: operator?.id || operator?.userId || input.identityId || "operator:missing",
      referenceType: "operator_review",
      label: "Operator attribution reference",
      status: operator ? "available" : "missing",
      blockedReason: operator ? null : "Operator attribution context is unavailable.",
    }),
  ];
}

export function deriveIdentityProfile(input: DeriveIdentityProfileInput): IdentityLayerProfile {
  const identityType = requestedIdentityType(input.identityType);
  const identityId = safeIdentityId(identityType, input.identityId);
  const sourceRecord =
    identityType === "tenant"
      ? input.tenant
      : identityType === "property"
        ? input.property
        : identityType === "organization"
          ? input.organization
          : input.operator;

  const verificationReferences =
    identityType === "tenant"
      ? tenantReferences(input)
      : identityType === "property"
        ? propertyReferences(input)
        : identityType === "organization"
          ? organizationReferences(input)
          : operatorReferences(input);

  const consentReferences = (input.consentRecords || []).map((record) => consentReference(record));
  const reviewReferences = (input.reviewSessions || []).map((review) =>
    identityReference({
      referenceId: review.id || review.reviewSessionId,
      referenceType: "operator_review",
      label: "Operator review session",
      destination: "/review-timeline",
      occurredAt: review.closedAt || review.openedAt || review.createdAt,
    })
  );
  const eventReferences = (input.canonicalEvents || []).map((event) =>
    identityReference({
      referenceId: event.id || event.eventId,
      referenceType: "canonical_event",
      label: asString(event.type || event.eventType, 120) || "Canonical event",
      destination: "/review-timeline",
      occurredAt: event.timestamp || event.createdAt || event.occurredAt,
      redacted: Boolean(event.redacted),
      status: event.redacted ? "redacted" : "available",
      blockedReason: event.redacted ? "Event payload is redacted for identity safety." : null,
    })
  );

  const blockedReasons: string[] = [];
  if (hasValue(sourceRecord, ["identityConflict", "blockedReason"])) {
    blockedReasons.push("Conflicting identity reference requires manual review.");
  }

  const status = statusFromReferences({
    sourceAvailable: Boolean(sourceRecord),
    verificationReferences,
    consentReferences,
    blockedReasons,
  });

  const verifiedReferences = verificationReferences.filter(isVerifiedReference).length;
  const missingReferences = verificationReferences.filter((reference) => reference.status === "missing").length;
  const blockedReferences = verificationReferences.filter((reference) => reference.status === "blocked").length;
  const missingConsentReasons = consentReferences.length ? [] : ["Consent lineage reference is missing."];
  const portabilityStatus = status === "verified" ? "ready" : verifiedReferences > 0 ? "limited" : "not_ready";
  const generatedAt = asString(input.generatedAt, 120) || new Date(0).toISOString();
  const lineageReferences = [...verificationReferences, ...consentReferences, ...reviewReferences, ...eventReferences];
  const trustState = deriveAccountTrustState({
    subjectType: trustSubjectType(identityType),
    subjectId: identityId.replace(/^[^:]+:/, "") || "unknown",
    generatedAt,
    signals: trustSignals({
      identityType,
      identityId,
      sourceRecord,
      verificationReferences,
      reviewReferences,
    }),
  });

  const canonicalEvents: IdentityLayerCanonicalEvent[] = [
    canonicalEvent({
      eventType: "identity_profile_derived",
      status,
      resourceType: identityType,
      resourceId: identityId,
      summary: "Identity profile derived from permission-scoped operational references.",
    }),
  ];

  if (verifiedReferences > 0) {
    canonicalEvents.push(
      canonicalEvent({
        eventType: "identity_verification_reference_attached",
        status,
        resourceType: identityType,
        resourceId: identityId,
        summary: "Verification lineage references are attached.",
      })
    );
  }
  if (consentReferences.length > 0) {
    canonicalEvents.push(
      canonicalEvent({
        eventType: "identity_consent_reference_attached",
        status,
        resourceType: identityType,
        resourceId: identityId,
        summary: "Consent lineage references are attached.",
      })
    );
  }
  if (status === "review_required") {
    canonicalEvents.push(
      canonicalEvent({
        eventType: "identity_review_required",
        status,
        resourceType: identityType,
        resourceId: identityId,
        summary: "Manual identity review is required before relying on this profile.",
      })
    );
  }
  if (status === "blocked") {
    canonicalEvents.push(
      canonicalEvent({
        eventType: "identity_blocked",
        status,
        resourceType: identityType,
        resourceId: identityId,
        summary: "Identity profile is blocked by conflicting or unsafe references.",
      })
    );
  }

  return {
    identityId,
    identityType,
    status,
    manualReviewRequired: true,
    publiclyShareable: false,
    externalInstitutionSharingEnabled: false,
    tokenizationEnabled: false,
    verificationSummary: {
      totalReferences: verificationReferences.length,
      verifiedReferences,
      missingReferences,
      blockedReferences,
    },
    consentSummary: {
      consentAvailable: consentReferences.length > 0,
      consentScope: consentReferences.map((reference) => reference.label),
      consentReferences: consentReferences.length,
      missingConsentReasons,
    },
    portabilitySummary: {
      portableReferenceAvailable: status === "verified" || status === "partially_verified",
      portabilityStatus,
      blockedReasons: portabilityStatus === "not_ready" ? ["Identity portability requires verified references."] : [],
    },
    trustState,
    lineageReferences,
    verificationReferences,
    consentReferences,
    reviewReferences,
    redactions: REDACTIONS,
    blockedReasons,
    canonicalEvents,
    generatedAt,
  };
}
