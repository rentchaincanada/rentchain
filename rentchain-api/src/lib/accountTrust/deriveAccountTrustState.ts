import type {
  AccountTrustEventDescriptor,
  AccountTrustLevel,
  AccountTrustStateSummary,
  AccountTrustSubjectType,
  DeriveAccountTrustStateInput,
  VerificationSignal,
  VerificationSignalType,
} from "./accountTrustTypes";

const SUBJECT_TYPES = new Set<AccountTrustSubjectType>([
  "tenant",
  "landlord",
  "applicant",
  "operator",
  "organization",
  "property",
]);

const BASE_MISSING_SIGNALS: VerificationSignalType[] = ["email", "phone", "identity"];

function asString(value: unknown, max = 240): string {
  return String(value ?? "").trim().slice(0, max);
}

function requestedSubjectType(value: unknown): AccountTrustSubjectType {
  const raw = asString(value, 80) as AccountTrustSubjectType;
  return SUBJECT_TYPES.has(raw) ? raw : "tenant";
}

function safeSubjectId(type: AccountTrustSubjectType, value: unknown) {
  const raw = asString(value, 400);
  return raw ? `${type}:${raw}` : `${type}:unknown`;
}

function trustCopy(level: AccountTrustLevel): Pick<AccountTrustStateSummary, "trustLabel" | "trustDescription"> {
  if (level === "institution_reviewed") {
    return {
      trustLabel: "Institution review recorded",
      trustDescription:
        "The account has institution or operator review metadata, but manual review and scoped consent still remain required.",
    };
  }
  if (level === "provider_attested") {
    return {
      trustLabel: "Provider-attested signals present",
      trustDescription:
        "At least one scoped provider, registry, or approved workflow signal is present. This is not raw identity custody.",
    };
  }
  if (level === "platform_correlated") {
    return {
      trustLabel: "Platform-correlated signals present",
      trustDescription:
        "Multiple RentChain operational records align, but they should not be treated as government-grade identity proof.",
    };
  }
  if (level === "authenticated") {
    return {
      trustLabel: "Authenticated account signal present",
      trustDescription:
        "The account has a verified access or contact signal, but broader institutional verification is still limited.",
    };
  }
  return {
    trustLabel: "Asserted account context",
    trustDescription:
      "The account context is based on asserted or incomplete information and is not institution-ready.",
  };
}

function eventDescriptor(params: {
  eventType: AccountTrustEventDescriptor["eventType"];
  subjectType: AccountTrustSubjectType;
  subjectId: string;
  trustLevel: AccountTrustLevel;
  summary: string;
}): AccountTrustEventDescriptor {
  return {
    eventType: params.eventType,
    action: params.eventType.replace(/_/g, "."),
    subjectType: params.subjectType,
    subjectId: params.subjectId,
    trustLevel: params.trustLevel,
    summary: params.summary,
    metadataOnly: true,
  };
}

function isActiveVerifiedSignal(signal: VerificationSignal) {
  return (
    signal.status === "verified" &&
    signal.metadataOnly === true &&
    signal.rawSensitivePayloadStored === false &&
    !signal.redacted &&
    !signal.revokedAt
  );
}

function isAuthenticatedSignal(signal: VerificationSignal) {
  return (
    isActiveVerifiedSignal(signal) &&
    (signal.signalType === "account_access" ||
      signal.signalType === "email" ||
      signal.signalType === "phone" ||
      signal.source === "firebase_auth" ||
      signal.source === "email_verification" ||
      signal.source === "phone_otp")
  );
}

function isProviderAttestedSignal(signal: VerificationSignal) {
  if (!isActiveVerifiedSignal(signal)) return false;
  if (signal.source === "future_identity_provider" || signal.source === "screening_provider") return true;
  if (signal.source === "public_registry" && signal.evidenceType === "registry_record") return true;
  if (signal.evidenceType === "provider_reference") return true;
  return ["identity", "business", "property", "institution"].includes(signal.signalType) && signal.confidence === "high";
}

function isInstitutionReviewedSignal(signal: VerificationSignal) {
  return (
    isActiveVerifiedSignal(signal) &&
    (signal.signalType === "institution" ||
      signal.source === "institution_review" ||
      (signal.source === "operator_review" && signal.evidenceType === "manual_review"))
  );
}

function isPlatformCorrelatedSignal(signal: VerificationSignal) {
  return (
    isActiveVerifiedSignal(signal) &&
    ["screening", "lease_participation", "payment_method", "property"].includes(signal.signalType)
  );
}

function deriveTrustLevel(signals: VerificationSignal[]): AccountTrustLevel {
  if (signals.some(isInstitutionReviewedSignal)) return "institution_reviewed";
  if (signals.some(isProviderAttestedSignal)) return "provider_attested";

  const authenticated = signals.some(isAuthenticatedSignal);
  const platformSignals = signals.filter(isPlatformCorrelatedSignal);
  const verifiedTypes = new Set(signals.filter(isActiveVerifiedSignal).map((signal) => signal.signalType));

  if (authenticated && (platformSignals.length > 0 || verifiedTypes.size >= 2)) return "platform_correlated";
  if (authenticated) return "authenticated";
  return "asserted";
}

function deriveMissingSignals(signals: VerificationSignal[]) {
  const activeTypes = new Set(signals.filter(isActiveVerifiedSignal).map((signal) => signal.signalType));
  return BASE_MISSING_SIGNALS.filter((signalType) => !activeTypes.has(signalType));
}

function deriveEvents(params: {
  subjectType: AccountTrustSubjectType;
  subjectId: string;
  trustLevel: AccountTrustLevel;
  previousTrustLevel: AccountTrustLevel | null;
  signals: VerificationSignal[];
}) {
  const events: AccountTrustEventDescriptor[] = [
    eventDescriptor({
      eventType: "account_trust_state_derived",
      subjectType: params.subjectType,
      subjectId: params.subjectId,
      trustLevel: params.trustLevel,
      summary: "Account trust state derived from metadata-only verification signals.",
    }),
  ];

  if (params.signals.length > 0) {
    events.push(
      eventDescriptor({
        eventType: "verification_signal_attached",
        subjectType: params.subjectType,
        subjectId: params.subjectId,
        trustLevel: params.trustLevel,
        summary: "Verification signal metadata is attached to the trust state.",
      })
    );
  }
  if (params.signals.some((signal) => signal.status === "pending")) {
    events.push(
      eventDescriptor({
        eventType: "account_verification_started",
        subjectType: params.subjectType,
        subjectId: params.subjectId,
        trustLevel: params.trustLevel,
        summary: "Account verification workflow has pending metadata.",
      })
    );
  }
  if (params.signals.some((signal) => signal.signalType === "email" && signal.status === "verified")) {
    events.push(
      eventDescriptor({
        eventType: "email_verified",
        subjectType: params.subjectType,
        subjectId: params.subjectId,
        trustLevel: params.trustLevel,
        summary: "Email verification signal is present.",
      })
    );
  }
  if (params.signals.some((signal) => signal.signalType === "phone" && signal.status === "verified")) {
    events.push(
      eventDescriptor({
        eventType: "phone_verified",
        subjectType: params.subjectType,
        subjectId: params.subjectId,
        trustLevel: params.trustLevel,
        summary: "Phone verification signal is present.",
      })
    );
  }
  if (params.signals.some((signal) => signal.signalType === "screening" && signal.status === "verified")) {
    events.push(
      eventDescriptor({
        eventType: "screening_verified",
        subjectType: params.subjectType,
        subjectId: params.subjectId,
        trustLevel: params.trustLevel,
        summary: "Screening workflow completion signal is present.",
      })
    );
  }
  if (params.signals.some((signal) => signal.signalType === "identity" && signal.status === "pending")) {
    events.push(
      eventDescriptor({
        eventType: "identity_verification_requested",
        subjectType: params.subjectType,
        subjectId: params.subjectId,
        trustLevel: params.trustLevel,
        summary: "Identity verification has been requested but is not complete.",
      })
    );
  }
  if (params.previousTrustLevel && params.previousTrustLevel !== params.trustLevel) {
    events.push(
      eventDescriptor({
        eventType: "trust_level_changed",
        subjectType: params.subjectType,
        subjectId: params.subjectId,
        trustLevel: params.trustLevel,
        summary: "Account trust level changed from the previous derived state.",
      })
    );
  }

  return events;
}

export function deriveAccountTrustState(input: DeriveAccountTrustStateInput): AccountTrustStateSummary {
  const subjectType = requestedSubjectType(input.subjectType);
  const subjectId = safeSubjectId(subjectType, input.subjectId);
  const signals = Array.isArray(input.signals) ? input.signals : [];
  const trustLevel = deriveTrustLevel(signals);
  const copy = trustCopy(trustLevel);
  const activeSignals = signals.filter(isActiveVerifiedSignal);
  const reviewReasons = signals
    .filter((signal) => signal.reviewRequired || signal.status === "manual_review_required")
    .map((signal) => `${signal.signalType} requires manual review.`);
  const generatedAt = asString(input.generatedAt, 120) || new Date(0).toISOString();

  return {
    subjectType,
    subjectId,
    trustLevel,
    trustLabel: copy.trustLabel,
    trustDescription: copy.trustDescription,
    manualReviewRequired: true,
    providerIntegrationEnabled: false,
    rawSensitivePayloadStored: false,
    executionEligible: false,
    externalSharingRequiresConsent: true,
    signalSummary: {
      totalSignals: signals.length,
      assertedSignals: signals.filter((signal) => signal.status === "asserted").length,
      pendingSignals: signals.filter((signal) => signal.status === "pending").length,
      verifiedSignals: activeSignals.length,
      providerAttestedSignals: signals.filter(isProviderAttestedSignal).length,
      expiredSignals: signals.filter((signal) => signal.status === "expired").length,
      revokedSignals: signals.filter((signal) => signal.status === "revoked" || Boolean(signal.revokedAt)).length,
      reviewRequiredSignals: signals.filter((signal) => signal.reviewRequired || signal.status === "manual_review_required").length,
    },
    activeSignals,
    missingSignals: deriveMissingSignals(signals),
    reviewReasons,
    redactions: [
      "Raw government identity documents are excluded.",
      "Raw screening provider payloads are excluded.",
      "Banking and payment account details are excluded.",
      "Trust state stores metadata-only verification signals.",
    ],
    canonicalEvents: deriveEvents({
      subjectType,
      subjectId,
      trustLevel,
      previousTrustLevel: input.previousTrustLevel || null,
      signals,
    }),
    generatedAt,
  };
}
