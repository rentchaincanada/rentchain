import { redactIdentifier } from "../governance/platformGovernance";
import { verificationSignal, type AccountTrustSubjectType, type VerificationSignal, type VerificationSource } from "../accountTrust";
import type {
  AuthorityConfidenceLevel,
  BusinessVerificationStatus,
  DerivePropertyTrustSummaryInput,
  OperatorAuthorityStatus,
  PropertyAuthorityRelationshipType,
  PropertyTrustEventDescriptor,
  PropertyTrustSubjectType,
  PropertyTrustSummary,
  PropertyVerificationAttestation,
  PropertyVerificationProviderType,
  PropertyVerificationStatus,
  RegistryLinkStatus,
} from "./propertyTrustTypes";

const SUBJECT_TYPES = new Set<PropertyTrustSubjectType>([
  "landlord",
  "organization",
  "business_entity",
  "property",
  "operator",
  "property_account_relationship",
]);

const CONFIDENCE_RANK: Record<AuthorityConfidenceLevel, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
};

const REDACTIONS = [
  "Raw title documents are excluded.",
  "Raw registry and provider payloads are excluded.",
  "Banking, KYB, and beneficial ownership payloads are excluded.",
  "Property authority metadata does not create a legal ownership conclusion.",
  "Support summaries expose redacted references only.",
];

function asString(value: unknown, max = 240): string {
  return String(value ?? "").trim().slice(0, max);
}

function requestedSubjectType(value: unknown): PropertyTrustSubjectType {
  const raw = asString(value, 80) as PropertyTrustSubjectType;
  return SUBJECT_TYPES.has(raw) ? raw : "property";
}

function safeSubjectId(type: PropertyTrustSubjectType, value: unknown) {
  const raw = asString(value, 400);
  return raw ? `${type}:${raw.replace(/^[^:]+:/, "")}` : `${type}:unknown`;
}

function optionalId(value: unknown) {
  return asString(value, 400) || null;
}

function isExpired(attestation: PropertyVerificationAttestation, generatedAt: string) {
  if (attestation.propertyStatus === "expired" || attestation.businessStatus === "expired") return true;
  if (!attestation.expiresAt) return false;
  const expiry = Date.parse(attestation.expiresAt);
  const now = Date.parse(generatedAt);
  return Number.isFinite(expiry) && Number.isFinite(now) && expiry <= now;
}

function isReverificationDue(attestation: PropertyVerificationAttestation, generatedAt: string) {
  if (!attestation.nextReverificationAt) return false;
  const next = Date.parse(attestation.nextReverificationAt);
  const now = Date.parse(generatedAt);
  return Number.isFinite(next) && Number.isFinite(now) && next <= now;
}

function isRevoked(attestation: PropertyVerificationAttestation) {
  return (
    attestation.businessStatus === "revoked" ||
    attestation.propertyStatus === "revoked" ||
    attestation.operatorAuthorityStatus === "revoked" ||
    Boolean(attestation.revokedAt)
  );
}

function isCompletedActive(attestation: PropertyVerificationAttestation, generatedAt: string) {
  return (
    attestation.metadataOnly === true &&
    attestation.rawSensitivePayloadStored === false &&
    attestation.publicShareable === false &&
    attestation.onboardingBlocking === false &&
    attestation.executionEligible === false &&
    attestation.legalOwnershipConclusion === false &&
    !isRevoked(attestation) &&
    !isExpired(attestation, generatedAt)
  );
}

function highestConfidence(attestations: PropertyVerificationAttestation[]) {
  return attestations.reduce<AuthorityConfidenceLevel>((highest, attestation) => {
    return CONFIDENCE_RANK[attestation.confidence] > CONFIDENCE_RANK[highest] ? attestation.confidence : highest;
  }, "none");
}

function dominantProvider(attestations: PropertyVerificationAttestation[]): PropertyVerificationProviderType {
  return attestations.find((attestation) => attestation.providerType !== "none")?.providerType || "none";
}

function statusRankBusiness(status: BusinessVerificationStatus) {
  return ["not_started", "self_asserted", "pending", "failed", "manual_review_required", "expired", "revoked", "completed"].indexOf(status);
}

function statusRankProperty(status: PropertyVerificationStatus) {
  return [
    "not_started",
    "self_asserted",
    "pending",
    "failed",
    "manual_review_required",
    "expired",
    "revoked",
    "registry_linked",
    "completed",
  ].indexOf(status);
}

function statusRankAuthority(status: OperatorAuthorityStatus) {
  return [
    "not_asserted",
    "self_asserted",
    "partially_supported",
    "manual_review_required",
    "expired",
    "revoked",
    "externally_supported",
    "institution_reviewed",
  ].indexOf(status);
}

function statusRankRegistry(status: RegistryLinkStatus) {
  return [
    "not_linked",
    "unverified",
    "source_unavailable",
    "manual_review_required",
    "pid_present",
    "syntax_validated",
    "partial_match",
    "linked",
  ].indexOf(status);
}

function relationshipRank(status: PropertyAuthorityRelationshipType) {
  return [
    "none",
    "landlord_asserted",
    "manager_asserted",
    "operator_asserted",
    "agent_authorized",
    "registry_linked",
    "institution_reviewed",
  ].indexOf(status);
}

function highestByRank<T extends string>(values: T[], fallback: T, ranker: (value: T) => number) {
  return values.reduce<T>((highest, value) => (ranker(value) > ranker(highest) ? value : highest), fallback);
}

function copy(params: {
  propertyStatus: PropertyVerificationStatus;
  businessStatus: BusinessVerificationStatus;
  operatorAuthorityStatus: OperatorAuthorityStatus;
  registryLinkStatus: RegistryLinkStatus;
  confidence: AuthorityConfidenceLevel;
}) {
  if (params.operatorAuthorityStatus === "institution_reviewed") {
    return {
      trustLabel: "Institution-reviewed operator authority",
      trustDescription:
        "A scoped institution or approved operator review supports property authority. This remains metadata-only and does not create a legal ownership conclusion.",
    };
  }
  if (params.operatorAuthorityStatus === "externally_supported") {
    return {
      trustLabel: "Operator authority externally supported",
      trustDescription:
        "External or provider-neutral authority metadata supports the operator relationship. Raw evidence payloads are not stored.",
    };
  }
  if (params.propertyStatus === "completed") {
    return {
      trustLabel: "Property verification metadata completed",
      trustDescription:
        "Property verification metadata is present for this subject. It should be read as authority evidence, not ownership adjudication.",
    };
  }
  if (params.registryLinkStatus === "linked" || params.propertyStatus === "registry_linked") {
    return {
      trustLabel: "Registry linkage established",
      trustDescription:
        "Registry lineage is linked for this property. Registry linkage alone does not prove ownership or operator authority.",
    };
  }
  if (params.businessStatus === "completed") {
    return {
      trustLabel: "Business verification metadata completed",
      trustDescription:
        "Business verification metadata is present. This is not stored KYB custody and does not prove property authority by itself.",
    };
  }
  if (params.operatorAuthorityStatus === "partially_supported" || params.confidence === "medium") {
    return {
      trustLabel: "Operator authority partially supported",
      trustDescription:
        "Some property or operator authority evidence is present, but institutional reliance still requires review.",
    };
  }
  if (params.operatorAuthorityStatus === "manual_review_required" || params.registryLinkStatus === "manual_review_required") {
    return {
      trustLabel: "Property authority review required",
      trustDescription:
        "Property or operator authority metadata requires manual review before institutional reliance.",
    };
  }
  return {
    trustLabel: "Property authority not verified",
    trustDescription:
      "No provider-neutral business, property, or operator authority attestation is present. Onboarding remains unblocked.",
  };
}

function eventDescriptor(params: {
  eventType: PropertyTrustEventDescriptor["eventType"];
  subjectType: PropertyTrustSubjectType;
  subjectId: string;
  authorityConfidence: AuthorityConfidenceLevel;
  summary: string;
}): PropertyTrustEventDescriptor {
  return {
    eventType: params.eventType,
    action: params.eventType.replace(/_/g, "."),
    subjectType: params.subjectType,
    subjectId: params.subjectId,
    authorityConfidence: params.authorityConfidence,
    summary: params.summary,
    metadataOnly: true,
  };
}

function deriveEvents(params: {
  subjectType: PropertyTrustSubjectType;
  subjectId: string;
  authorityConfidence: AuthorityConfidenceLevel;
  attestations: PropertyVerificationAttestation[];
  generatedAt: string;
}) {
  const events: PropertyTrustEventDescriptor[] = [];
  if (params.attestations.some((attestation) => attestation.businessStatus === "pending")) {
    events.push(
      eventDescriptor({
        eventType: "business_verification_started",
        subjectType: params.subjectType,
        subjectId: params.subjectId,
        authorityConfidence: params.authorityConfidence,
        summary: "Business verification metadata workflow has started.",
      })
    );
  }
  if (params.attestations.some((attestation) => attestation.businessStatus === "completed")) {
    events.push(
      eventDescriptor({
        eventType: "business_verification_completed",
        subjectType: params.subjectType,
        subjectId: params.subjectId,
        authorityConfidence: params.authorityConfidence,
        summary: "Business verification metadata is completed without raw KYB custody.",
      })
    );
  }
  if (params.attestations.some((attestation) => attestation.propertyStatus === "pending")) {
    events.push(
      eventDescriptor({
        eventType: "property_verification_started",
        subjectType: params.subjectType,
        subjectId: params.subjectId,
        authorityConfidence: params.authorityConfidence,
        summary: "Property verification metadata workflow has started.",
      })
    );
  }
  if (params.attestations.some((attestation) => attestation.registryLinkStatus === "linked")) {
    events.push(
      eventDescriptor({
        eventType: "property_registry_linked",
        subjectType: params.subjectType,
        subjectId: params.subjectId,
        authorityConfidence: params.authorityConfidence,
        summary: "Property registry linkage metadata is present.",
      })
    );
  }
  if (
    params.attestations.some((attestation) =>
      ["externally_supported", "institution_reviewed"].includes(attestation.operatorAuthorityStatus)
    )
  ) {
    events.push(
      eventDescriptor({
        eventType: "operator_authority_confirmed",
        subjectType: params.subjectType,
        subjectId: params.subjectId,
        authorityConfidence: params.authorityConfidence,
        summary: "Operator authority metadata is supported without creating an ownership conclusion.",
      })
    );
  }
  if (params.attestations.some((attestation) => isExpired(attestation, params.generatedAt))) {
    events.push(
      eventDescriptor({
        eventType: "property_verification_expired",
        subjectType: params.subjectType,
        subjectId: params.subjectId,
        authorityConfidence: params.authorityConfidence,
        summary: "Property or business authority metadata expired.",
      })
    );
  }
  if (params.attestations.some((attestation) => isReverificationDue(attestation, params.generatedAt))) {
    events.push(
      eventDescriptor({
        eventType: "property_reverification_required",
        subjectType: params.subjectType,
        subjectId: params.subjectId,
        authorityConfidence: params.authorityConfidence,
        summary: "Property authority reverification is required before institutional reliance.",
      })
    );
  }
  return events;
}

function nextReverificationAt(attestations: PropertyVerificationAttestation[]) {
  const values = attestations
    .map((attestation) => attestation.nextReverificationAt)
    .filter((value): value is string => Boolean(value))
    .sort();
  return values[0] || null;
}

function toSupportAttestation(attestation: PropertyVerificationAttestation) {
  return {
    attestationId: attestation.attestationId,
    subjectType: attestation.subjectType,
    relationshipType: attestation.relationshipType,
    businessStatus: attestation.businessStatus,
    propertyStatus: attestation.propertyStatus,
    operatorAuthorityStatus: attestation.operatorAuthorityStatus,
    registryLinkStatus: attestation.registryLinkStatus,
    providerType: attestation.providerType,
    providerKey: attestation.providerKey,
    providerReferenceRedacted: redactIdentifier(attestation.providerReferenceId),
    evidenceRefRedacted: redactIdentifier(attestation.evidenceRef),
    confidence: attestation.confidence,
    consentPurpose: attestation.consentScope.purpose,
    retentionClass: attestation.retentionClass,
    completedAt: attestation.completedAt,
    expiresAt: attestation.expiresAt,
    nextReverificationAt: attestation.nextReverificationAt,
    reviewRequired: attestation.reviewRequired,
  };
}

export function derivePropertyTrustSummary(input: DerivePropertyTrustSummaryInput): PropertyTrustSummary {
  const subjectType = requestedSubjectType(input.subjectType);
  const subjectId = safeSubjectId(subjectType, input.subjectId);
  const generatedAt = asString(input.generatedAt, 120) || new Date(0).toISOString();
  const attestations = Array.isArray(input.attestations)
    ? input.attestations.filter(
        (attestation) =>
          attestation.metadataOnly === true &&
          attestation.rawSensitivePayloadStored === false &&
          attestation.publicShareable === false &&
          attestation.onboardingBlocking === false &&
          attestation.executionEligible === false &&
          attestation.legalOwnershipConclusion === false
      )
    : [];
  const active = attestations.filter((attestation) => isCompletedActive(attestation, generatedAt));
  const businessStatus = highestByRank(
    active.map((attestation) => attestation.businessStatus),
    "not_started" as BusinessVerificationStatus,
    statusRankBusiness
  );
  const propertyStatus = highestByRank(
    active.map((attestation) => attestation.propertyStatus),
    "not_started" as PropertyVerificationStatus,
    statusRankProperty
  );
  const operatorAuthorityStatus = highestByRank(
    active.map((attestation) => attestation.operatorAuthorityStatus),
    "not_asserted" as OperatorAuthorityStatus,
    statusRankAuthority
  );
  const registryLinkStatus = highestByRank(
    active.map((attestation) => attestation.registryLinkStatus),
    "not_linked" as RegistryLinkStatus,
    statusRankRegistry
  );
  const relationshipType = highestByRank(
    active.map((attestation) => attestation.relationshipType),
    "none" as PropertyAuthorityRelationshipType,
    relationshipRank
  );
  const authorityConfidence = highestConfidence(active);
  const content = copy({
    propertyStatus,
    businessStatus,
    operatorAuthorityStatus,
    registryLinkStatus,
    confidence: authorityConfidence,
  });
  const reviewReasons = attestations
    .filter(
      (attestation) =>
        attestation.reviewRequired ||
        attestation.businessStatus === "manual_review_required" ||
        attestation.propertyStatus === "manual_review_required" ||
        attestation.operatorAuthorityStatus === "manual_review_required" ||
        attestation.registryLinkStatus === "manual_review_required"
    )
    .map((attestation) => `${attestation.relationshipType} authority metadata requires manual review.`);

  return {
    subjectType,
    subjectId,
    propertyId: optionalId(input.propertyId) || active[0]?.propertyId || null,
    accountId: optionalId(input.accountId) || active[0]?.accountId || null,
    businessId: optionalId(input.businessId) || active[0]?.businessId || null,
    businessStatus,
    propertyStatus,
    operatorAuthorityStatus,
    registryLinkStatus,
    relationshipType,
    authorityConfidence,
    trustLabel: content.trustLabel,
    trustDescription: content.trustDescription,
    providerCategory: dominantProvider(active),
    consentRequired: true,
    consentAvailable: attestations.some((attestation) => Boolean(attestation.consentScope.consentId)),
    retentionClass: attestations[0]?.retentionClass || "authority_metadata",
    metadataOnly: true,
    rawSensitivePayloadStored: false,
    liveRegistryIntegrationEnabled: false,
    onboardingBlocking: false,
    publicShareable: false,
    executionEligible: false,
    legalOwnershipConclusion: false,
    reverificationRequired: attestations.some((attestation) => isReverificationDue(attestation, generatedAt)),
    nextReverificationAt: nextReverificationAt(attestations),
    signalSummary: {
      totalAttestations: attestations.length,
      businessCompletedAttestations: active.filter((attestation) => attestation.businessStatus === "completed").length,
      propertyCompletedAttestations: active.filter((attestation) =>
        ["completed", "registry_linked"].includes(attestation.propertyStatus)
      ).length,
      operatorAuthorityAttestations: active.filter((attestation) =>
        ["partially_supported", "externally_supported", "institution_reviewed"].includes(attestation.operatorAuthorityStatus)
      ).length,
      registryLinkedAttestations: active.filter((attestation) => attestation.registryLinkStatus === "linked").length,
      expiredAttestations: attestations.filter((attestation) => isExpired(attestation, generatedAt)).length,
      revokedAttestations: attestations.filter(isRevoked).length,
      reviewRequiredAttestations: attestations.filter((attestation) => attestation.reviewRequired).length,
    },
    supportSummary: {
      visibleToSupport: true,
      rawTitleDocumentVisible: false,
      rawRegistryPayloadVisible: false,
      rawBankingPayloadVisible: false,
      legalOwnershipConclusionVisible: false,
      attestations: attestations.filter((attestation) => attestation.supportVisible).map(toSupportAttestation),
    },
    redactions: REDACTIONS,
    reviewReasons,
    canonicalEvents: deriveEvents({
      subjectType,
      subjectId,
      authorityConfidence,
      attestations,
      generatedAt,
    }),
    generatedAt,
  };
}

function accountTrustSubjectType(subjectType: PropertyTrustSubjectType): AccountTrustSubjectType {
  if (subjectType === "property") return "property";
  if (subjectType === "organization" || subjectType === "business_entity") return "organization";
  if (subjectType === "operator") return "operator";
  return "landlord";
}

function sourceForAttestation(attestation: PropertyVerificationAttestation): VerificationSource {
  if (attestation.providerType === "public_registry" || attestation.providerType === "title_registry") return "public_registry";
  if (attestation.providerType === "institution_review") return "institution_review";
  if (attestation.providerType === "operator_review") return "operator_review";
  return "future_identity_provider";
}

export function propertyTrustSignalsFromAttestations(params: {
  attestations?: PropertyVerificationAttestation[] | null;
  generatedAt?: unknown;
}): VerificationSignal[] {
  const generatedAt = asString(params.generatedAt, 120) || new Date(0).toISOString();
  return (params.attestations || [])
    .filter((attestation) => isCompletedActive(attestation, generatedAt))
    .flatMap((attestation) => {
      const subjectType = accountTrustSubjectType(attestation.subjectType);
      const subjectId = attestation.subjectId.replace(/^[^:]+:/, "") || "unknown";
      const base = {
        subjectType,
        subjectId,
        status: "verified" as const,
        source: sourceForAttestation(attestation),
        confidence: attestation.confidence === "none" ? ("low" as const) : attestation.confidence,
        providerKey: attestation.providerKey || attestation.providerType,
        evidenceRef: `property_trust:${attestation.attestationId}`,
        issuedAt: attestation.issuedAt,
        verifiedAt: attestation.completedAt,
        expiresAt: attestation.expiresAt,
        revokedAt: attestation.revokedAt,
        reviewRequired: attestation.reviewRequired,
      };
      const signals: VerificationSignal[] = [];
      if (attestation.businessStatus === "completed") {
        signals.push(
          verificationSignal({
            ...base,
            signalType: "business",
            evidenceType: "provider_reference",
          })
        );
      }
      if (["completed", "registry_linked"].includes(attestation.propertyStatus) || attestation.registryLinkStatus === "linked") {
        signals.push(
          verificationSignal({
            ...base,
            signalType: "property",
            evidenceType: attestation.providerType === "public_registry" ? "registry_record" : "provider_reference",
          })
        );
      }
      if (["externally_supported", "institution_reviewed"].includes(attestation.operatorAuthorityStatus)) {
        signals.push(
          verificationSignal({
            ...base,
            signalType: attestation.operatorAuthorityStatus === "institution_reviewed" ? "institution" : "property",
            evidenceType: attestation.providerType === "operator_review" ? "manual_review" : "provider_reference",
          })
        );
      }
      return signals;
    });
}
