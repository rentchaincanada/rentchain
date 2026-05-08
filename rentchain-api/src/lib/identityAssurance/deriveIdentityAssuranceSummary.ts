import { redactIdentifier } from "../governance/platformGovernance";
import { verificationSignal, type AccountTrustSubjectType, type VerificationSignal } from "../accountTrust";
import type {
  DeriveIdentityAssuranceSummaryInput,
  IdentityAssuranceAttestation,
  IdentityAssuranceEventDescriptor,
  IdentityAssuranceLevel,
  IdentityAssuranceLifecycleState,
  IdentityAssuranceProviderType,
  IdentityAssuranceStatus,
  IdentityAssuranceSubjectType,
  IdentityAssuranceSummary,
} from "./identityAssuranceTypes";

const SUBJECT_TYPES = new Set<IdentityAssuranceSubjectType>([
  "tenant",
  "landlord",
  "applicant",
  "property_operator",
  "business_entity",
  "organization",
  "property",
]);

const LEVEL_RANK: Record<IdentityAssuranceLevel, number> = {
  not_assessed: 0,
  account_controlled: 1,
  platform_correlated: 2,
  provider_identity_attested: 3,
  business_attested: 4,
  property_authority_attested: 5,
  institution_reviewed: 6,
};

const REDACTIONS = [
  "Raw government identity documents are excluded.",
  "Raw biometric and liveness payloads are excluded.",
  "Raw provider identity payloads are excluded.",
  "Identity document numbers and SIN/SSN equivalents are excluded.",
  "Support summaries expose redacted provider references only.",
];

function asString(value: unknown, max = 240): string {
  return String(value ?? "").trim().slice(0, max);
}

function requestedSubjectType(value: unknown): IdentityAssuranceSubjectType {
  const raw = asString(value, 80) as IdentityAssuranceSubjectType;
  return SUBJECT_TYPES.has(raw) ? raw : "tenant";
}

function safeSubjectId(type: IdentityAssuranceSubjectType, value: unknown) {
  const raw = asString(value, 400);
  return raw ? `${type}:${raw.replace(/^[^:]+:/, "")}` : `${type}:unknown`;
}

function isExpired(attestation: IdentityAssuranceAttestation, generatedAt: string) {
  if (attestation.status === "expired") return true;
  if (!attestation.expiresAt) return false;
  const expiry = Date.parse(attestation.expiresAt);
  const now = Date.parse(generatedAt);
  return Number.isFinite(expiry) && Number.isFinite(now) && expiry <= now;
}

function isReverificationDue(attestation: IdentityAssuranceAttestation, generatedAt: string) {
  if (!attestation.nextReverificationAt) return false;
  const next = Date.parse(attestation.nextReverificationAt);
  const now = Date.parse(generatedAt);
  return Number.isFinite(next) && Number.isFinite(now) && next <= now;
}

function isCompletedActive(attestation: IdentityAssuranceAttestation, generatedAt: string) {
  return (
    attestation.status === "completed" &&
    attestation.metadataOnly === true &&
    attestation.rawSensitivePayloadStored === false &&
    !attestation.revokedAt &&
    attestation.lifecycleState !== "revoked" &&
    !isExpired(attestation, generatedAt)
  );
}

function highestLevel(attestations: IdentityAssuranceAttestation[], generatedAt: string): IdentityAssuranceLevel {
  const active = attestations.filter((attestation) => isCompletedActive(attestation, generatedAt));
  if (!active.length) return "not_assessed";
  return active.reduce<IdentityAssuranceLevel>((level, attestation) => {
    return LEVEL_RANK[attestation.level] > LEVEL_RANK[level] ? attestation.level : level;
  }, "not_assessed");
}

function dominantProvider(attestations: IdentityAssuranceAttestation[], generatedAt: string): IdentityAssuranceProviderType {
  return attestations.find((attestation) => isCompletedActive(attestation, generatedAt))?.providerType || "none";
}

function deriveStatus(attestations: IdentityAssuranceAttestation[], generatedAt: string): IdentityAssuranceStatus {
  if (!attestations.length) return "not_started";
  if (attestations.some((attestation) => attestation.status === "revoked" || attestation.revokedAt)) return "revoked";
  if (attestations.some((attestation) => isExpired(attestation, generatedAt))) return "expired";
  if (attestations.some((attestation) => attestation.status === "manual_review_required" || attestation.reviewRequired)) {
    return "manual_review_required";
  }
  if (attestations.some((attestation) => attestation.status === "failed")) return "failed";
  if (attestations.some((attestation) => isCompletedActive(attestation, generatedAt))) return "completed";
  if (attestations.some((attestation) => attestation.status === "pending")) return "pending";
  if (attestations.some((attestation) => attestation.status === "requested")) return "requested";
  return "not_started";
}

function deriveLifecycle(
  status: IdentityAssuranceStatus,
  attestations: IdentityAssuranceAttestation[],
  generatedAt: string
): IdentityAssuranceLifecycleState {
  if (status === "revoked") return "revoked";
  if (status === "failed") return "failed";
  if (status === "manual_review_required") return "manual_review_required";
  if (status === "completed" && attestations.some((attestation) => isReverificationDue(attestation, generatedAt))) {
    return "reverification_required";
  }
  if (status === "completed") return "completed";
  if (status === "pending" || status === "requested") return "in_progress";
  if (attestations.some((attestation) => !attestation.consentScope.consentId)) return "consent_required";
  return "not_started";
}

function assuranceCopy(level: IdentityAssuranceLevel, lifecycleState: IdentityAssuranceLifecycleState) {
  if (lifecycleState === "reverification_required") {
    return {
      assuranceLabel: "Reverification required",
      assuranceDescription:
        "Identity assurance metadata exists, but the subject needs a fresh provider or review workflow before institutional reliance.",
    };
  }
  if (level === "institution_reviewed") {
    return {
      assuranceLabel: "Institution review recorded",
      assuranceDescription:
        "A scoped institution or approved operator review is recorded. It remains consent-scoped and does not authorize execution.",
    };
  }
  if (level === "property_authority_attested") {
    return {
      assuranceLabel: "Property authority attestation present",
      assuranceDescription:
        "Provider-neutral property authority metadata is present. Raw ownership documents and provider payloads are not stored.",
    };
  }
  if (level === "business_attested") {
    return {
      assuranceLabel: "Business attestation present",
      assuranceDescription:
        "Provider-neutral business assurance metadata is present. This is not a stored KYB payload.",
    };
  }
  if (level === "provider_identity_attested") {
    return {
      assuranceLabel: "Identity assurance completed through approved workflow",
      assuranceDescription:
        "A provider-neutral identity attestation is present. RentChain stores metadata only, not raw identity documents.",
    };
  }
  if (level === "platform_correlated") {
    return {
      assuranceLabel: "Platform-correlated identity signals",
      assuranceDescription:
        "RentChain operational records align, but this is not provider-grade identity assurance.",
    };
  }
  if (level === "account_controlled") {
    return {
      assuranceLabel: "Account-control assurance only",
      assuranceDescription:
        "The subject has account or contact-channel control signals, but institutional identity assurance has not been completed.",
    };
  }
  return {
    assuranceLabel: "Identity assurance not started",
    assuranceDescription:
      "No provider-neutral identity assurance attestation is present. Existing onboarding remains unblocked.",
  };
}

function eventDescriptor(params: {
  eventType: IdentityAssuranceEventDescriptor["eventType"];
  subjectType: IdentityAssuranceSubjectType;
  subjectId: string;
  status: IdentityAssuranceStatus;
  level: IdentityAssuranceLevel;
  summary: string;
}): IdentityAssuranceEventDescriptor {
  return {
    eventType: params.eventType,
    action: params.eventType.replace(/_/g, "."),
    subjectType: params.subjectType,
    subjectId: params.subjectId,
    status: params.status,
    level: params.level,
    summary: params.summary,
    metadataOnly: true,
  };
}

function deriveEvents(params: {
  subjectType: IdentityAssuranceSubjectType;
  subjectId: string;
  status: IdentityAssuranceStatus;
  level: IdentityAssuranceLevel;
  lifecycleState: IdentityAssuranceLifecycleState;
  attestations: IdentityAssuranceAttestation[];
}) {
  const events: IdentityAssuranceEventDescriptor[] = [];
  if (params.attestations.some((attestation) => attestation.status === "requested")) {
    events.push(
      eventDescriptor({
        eventType: "identity_assurance_requested",
        subjectType: params.subjectType,
        subjectId: params.subjectId,
        status: params.status,
        level: params.level,
        summary: "Identity assurance workflow has been requested.",
      })
    );
  }
  if (params.attestations.some((attestation) => attestation.status === "pending")) {
    events.push(
      eventDescriptor({
        eventType: "identity_assurance_started",
        subjectType: params.subjectType,
        subjectId: params.subjectId,
        status: params.status,
        level: params.level,
        summary: "Identity assurance workflow has started and remains metadata-only.",
      })
    );
  }
  if (params.status === "completed" || params.lifecycleState === "reverification_required") {
    events.push(
      eventDescriptor({
        eventType: "identity_assurance_completed",
        subjectType: params.subjectType,
        subjectId: params.subjectId,
        status: params.status,
        level: params.level,
        summary: "Identity assurance completed through a provider-neutral metadata workflow.",
      })
    );
  }
  if (params.status === "failed") {
    events.push(
      eventDescriptor({
        eventType: "identity_assurance_failed",
        subjectType: params.subjectType,
        subjectId: params.subjectId,
        status: params.status,
        level: params.level,
        summary: "Identity assurance workflow failed and requires review before reliance.",
      })
    );
  }
  if (params.status === "expired") {
    events.push(
      eventDescriptor({
        eventType: "identity_assurance_expired",
        subjectType: params.subjectType,
        subjectId: params.subjectId,
        status: params.status,
        level: params.level,
        summary: "Identity assurance metadata expired.",
      })
    );
  }
  if (params.status === "revoked") {
    events.push(
      eventDescriptor({
        eventType: "identity_assurance_revoked",
        subjectType: params.subjectType,
        subjectId: params.subjectId,
        status: params.status,
        level: params.level,
        summary: "Identity assurance metadata was revoked.",
      })
    );
  }
  if (params.lifecycleState === "reverification_required") {
    events.push(
      eventDescriptor({
        eventType: "identity_assurance_reverification_required",
        subjectType: params.subjectType,
        subjectId: params.subjectId,
        status: params.status,
        level: params.level,
        summary: "Identity assurance reverification is required before institutional reliance.",
      })
    );
  }
  return events;
}

function nextReverificationAt(attestations: IdentityAssuranceAttestation[]) {
  const values = attestations
    .map((attestation) => attestation.nextReverificationAt)
    .filter((value): value is string => Boolean(value))
    .sort();
  return values[0] || null;
}

function toSupportAttestation(attestation: IdentityAssuranceAttestation) {
  return {
    attestationId: attestation.attestationId,
    level: attestation.level,
    status: attestation.status,
    lifecycleState: attestation.lifecycleState,
    providerType: attestation.providerType,
    providerKey: attestation.providerKey,
    providerReferenceRedacted: redactIdentifier(attestation.providerReferenceId),
    evidenceRefRedacted: redactIdentifier(attestation.evidenceRef),
    consentPurpose: attestation.consentScope.purpose,
    retentionClass: attestation.retentionClass,
    completedAt: attestation.completedAt,
    expiresAt: attestation.expiresAt,
    nextReverificationAt: attestation.nextReverificationAt,
    reviewRequired: attestation.reviewRequired,
  };
}

export function deriveIdentityAssuranceSummary(
  input: DeriveIdentityAssuranceSummaryInput
): IdentityAssuranceSummary {
  const subjectType = requestedSubjectType(input.subjectType);
  const subjectId = safeSubjectId(subjectType, input.subjectId);
  const generatedAt = asString(input.generatedAt, 120) || new Date(0).toISOString();
  const attestations = Array.isArray(input.attestations)
    ? input.attestations.filter(
        (attestation) =>
          attestation.metadataOnly === true &&
          attestation.rawSensitivePayloadStored === false &&
          attestation.publicShareable === false
      )
    : [];
  const status = deriveStatus(attestations, generatedAt);
  const level = highestLevel(attestations, generatedAt);
  const lifecycleState = deriveLifecycle(status, attestations, generatedAt);
  const copy = assuranceCopy(level, lifecycleState);
  const completedAttestations = attestations.filter((attestation) => isCompletedActive(attestation, generatedAt));
  const reviewReasons = attestations
    .filter((attestation) => attestation.reviewRequired || attestation.status === "manual_review_required")
    .map((attestation) => `${attestation.level} requires manual review.`);

  return {
    subjectType,
    subjectId,
    status,
    level,
    lifecycleState,
    assuranceLabel: copy.assuranceLabel,
    assuranceDescription: copy.assuranceDescription,
    providerCategory: dominantProvider(attestations, generatedAt),
    consentRequired: true,
    consentAvailable: attestations.some((attestation) => Boolean(attestation.consentScope.consentId)),
    retentionClass: attestations[0]?.retentionClass || "assurance_metadata",
    metadataOnly: true,
    rawSensitivePayloadStored: false,
    providerIntegrationEnabled: false,
    onboardingBlocking: false,
    publicShareable: false,
    executionEligible: false,
    reverificationRequired: lifecycleState === "reverification_required",
    nextReverificationAt: nextReverificationAt(attestations),
    signalSummary: {
      totalAttestations: attestations.length,
      completedAttestations: completedAttestations.length,
      pendingAttestations: attestations.filter((attestation) => attestation.status === "pending" || attestation.status === "requested").length,
      failedAttestations: attestations.filter((attestation) => attestation.status === "failed").length,
      expiredAttestations: attestations.filter((attestation) => isExpired(attestation, generatedAt)).length,
      revokedAttestations: attestations.filter((attestation) => attestation.status === "revoked" || Boolean(attestation.revokedAt)).length,
      reviewRequiredAttestations: attestations.filter((attestation) => attestation.reviewRequired || attestation.status === "manual_review_required").length,
    },
    supportSummary: {
      visibleToSupport: true,
      rawProviderPayloadVisible: false,
      rawIdentityDocumentVisible: false,
      biometricPayloadVisible: false,
      identityDocumentNumberVisible: false,
      attestations: attestations.filter((attestation) => attestation.supportVisible).map(toSupportAttestation),
    },
    redactions: REDACTIONS,
    reviewReasons,
    canonicalEvents: deriveEvents({
      subjectType,
      subjectId,
      status,
      level,
      lifecycleState,
      attestations,
    }),
    generatedAt,
  };
}

function accountTrustSubjectType(subjectType: IdentityAssuranceSubjectType): AccountTrustSubjectType {
  if (subjectType === "property") return "property";
  if (subjectType === "organization" || subjectType === "business_entity") return "organization";
  if (subjectType === "property_operator") return "operator";
  return subjectType;
}

function signalTypeForLevel(level: IdentityAssuranceLevel): VerificationSignal["signalType"] {
  if (level === "business_attested") return "business";
  if (level === "property_authority_attested") return "property";
  if (level === "institution_reviewed") return "institution";
  return "identity";
}

export function identityAssuranceSignalsFromAttestations(params: {
  attestations?: IdentityAssuranceAttestation[] | null;
  generatedAt?: unknown;
}): VerificationSignal[] {
  const generatedAt = asString(params.generatedAt, 120) || new Date(0).toISOString();
  return (params.attestations || [])
    .filter((attestation) => isCompletedActive(attestation, generatedAt))
    .map((attestation) =>
      verificationSignal({
        signalType: signalTypeForLevel(attestation.level),
        subjectType: accountTrustSubjectType(attestation.subjectType),
        subjectId: attestation.subjectId.replace(/^[^:]+:/, "") || "unknown",
        status: "verified",
        source: attestation.providerType === "institution_review" ? "institution_review" : "future_identity_provider",
        evidenceType: "provider_reference",
        confidence: attestation.confidence,
        providerKey: attestation.providerKey || attestation.providerType,
        evidenceRef: `identity_assurance:${attestation.attestationId}`,
        issuedAt: attestation.issuedAt,
        verifiedAt: attestation.completedAt,
        expiresAt: attestation.expiresAt,
        revokedAt: attestation.revokedAt,
        reviewRequired: attestation.reviewRequired,
      })
    );
}
