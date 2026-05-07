import type {
  CredentialingReference,
  CredentialingReferenceStatus,
  CredentialingReferenceType,
  DerivePlatformCredentialingReadinessInput,
  PlatformCredentialingCanonicalEvent,
  PlatformCredentialingReadiness,
  PlatformCredentialingStatus,
} from "./platformCredentialingTypes";
import { credentialingIdPart, credentialingReference, credentialingRestriction } from "./credentialingRestrictionModels";

const DEFAULT_READINESS_KEY = "institutional-platform-credentialing-readiness-v1";

const REDACTIONS = [
  "CRA registration claims, bureau approval claims, bureau credentials, and provider credentials are excluded.",
  "Raw screening, credit bureau, government ID, tenant private document, payment account, and banking payloads are excluded.",
  "Platform credentialing readiness is visibility metadata only; no consumer-reporting execution or autonomous credential approval is enabled.",
  "Public credential marketplaces, unrestricted credential delegation, and live institutional onboarding execution are excluded.",
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

function referenceStatus(record: Record<string, any>, verifiedStatuses: string[]): CredentialingReferenceStatus {
  const status = asString(record?.status || record?.state || record?.conclusion, 80).toLowerCase();
  if (status === "blocked" || status === "elevated" || status === "failure" || status === "failed" || status === "error" || status === "cancelled") return "blocked";
  if (verifiedStatuses.includes(status)) return "verified";
  if (status === "missing" || status === "unknown" || status === "unavailable" || status === "pending") return "unavailable";
  return "partially_verified";
}

function statusForType(referenceType: CredentialingReferenceType, record: Record<string, any>): CredentialingReferenceStatus {
  if (referenceType === "verification") return referenceStatus(record, ["ready_for_review", "verified", "partially_verified", "stable"]);
  if (referenceType === "interoperability") return referenceStatus(record, ["ready_for_review", "sandbox_ready", "verified"]);
  if (referenceType === "review") return referenceStatus(record, ["ready_for_review", "completed", "verified"]);
  if (referenceType === "audit" && asString(record?.eventType, 120)) return "verified";
  return referenceStatus(record, ["ready_for_review", "verified", "stable", "available", "configured"]);
}

function readinessStatus(hasContext: boolean, references: CredentialingReference[]): PlatformCredentialingStatus {
  if (!hasContext) return "unknown";
  if (references.some((reference) => reference.status === "blocked" && (reference.referenceType === "governance" || reference.referenceType === "privacy" || reference.referenceType === "consent"))) {
    return "blocked";
  }
  const criticalMissing = references.some(
    (reference) =>
      reference.status === "unavailable" &&
      (reference.referenceType === "governance" ||
        reference.referenceType === "consent" ||
        reference.referenceType === "audit" ||
        reference.referenceType === "evidence" ||
        reference.referenceType === "review")
  );
  if (criticalMissing) return "review_required";
  if (references.some((reference) => reference.status === "blocked" || reference.status === "unavailable" || reference.status === "partially_verified")) return "partially_ready";
  return "ready_for_review";
}

function event(input: {
  eventType: PlatformCredentialingCanonicalEvent["eventType"];
  status: PlatformCredentialingStatus;
  platformCredentialingId: string;
  summary: string;
}): PlatformCredentialingCanonicalEvent {
  return {
    eventType: input.eventType,
    action: input.eventType.replace(/^platform_credentialing_/, "").replace(/_/g, "."),
    status: input.status,
    resourceType: "platform_credentialing_readiness",
    resourceId: input.platformCredentialingId,
    summary: input.summary,
  };
}

function referencesFor(input: {
  records: Record<string, any>[];
  fallback: string;
  referenceType: CredentialingReferenceType;
  idKeys: string[];
  label: string;
  description: string;
  destination: string;
  blockedReason: string;
}): CredentialingReference[] {
  if (!input.records.length) {
    return [
      credentialingReference({
        idParts: [input.referenceType, "missing"],
        referenceType: input.referenceType,
        status: "unavailable",
        label: input.label,
        description: `${input.description} is unavailable for platform credentialing review.`,
        destination: input.destination,
      }),
    ];
  }
  return input.records.map((record, index) => {
    const id = recordId(record, input.idKeys) || `${input.fallback}-${index + 1}`;
    const status = statusForType(input.referenceType, record);
    return credentialingReference({
      idParts: [input.referenceType, id],
      referenceType: input.referenceType,
      status,
      label: input.label,
      description: `${input.description} is available for platform credentialing review.`,
      lineageReferences: [id].filter(Boolean),
      destination: input.destination,
      redacted: Boolean(record.redacted),
      redactionReason: record.redacted ? `${input.label} payload is redacted for credentialing safety.` : null,
      blockedReason: status === "blocked" ? input.blockedReason : null,
    });
  });
}

export function derivePlatformCredentialingReadiness(input: DerivePlatformCredentialingReadinessInput): PlatformCredentialingReadiness {
  const readinessKey = asString(input.readinessKey, 160) || DEFAULT_READINESS_KEY;
  const platformCredentialingId =
    credentialingIdPart(["platform_credentialing", readinessKey].join(":")) || "platform_credentialing:unknown";

  const governanceReadiness = asArray(input.governanceReadiness);
  const privacyReadiness = asArray(input.privacyReadiness);
  const consentGovernance = asArray(input.consentGovernance);
  const auditLineage = asArray(input.auditLineage);
  const verificationReadiness = asArray(input.verificationReadiness);
  const interoperabilityReadiness = asArray(input.interoperabilityReadiness);
  const institutionOnboardingReadiness = asArray(input.institutionOnboardingReadiness);
  const operationalRiskProfiles = asArray(input.operationalRiskProfiles);
  const evidencePacks = asArray(input.evidencePacks);
  const reviews = asArray(input.operatorReviewSessions);

  const governanceReferences = [
    ...referencesFor({
      records: governanceReadiness,
      fallback: "governance",
      referenceType: "governance",
      idKeys: ["governanceReadinessId", "releaseGovernanceId", "publicExposureHardeningId", "commercialReadinessId", "ecosystemCoordinationId", "id"],
      label: "Platform governance reference",
      description: "Platform governance readiness metadata",
      destination: "/admin/ecosystem-coordination",
      blockedReason: "Platform governance readiness is blocked.",
    }),
    ...referencesFor({
      records: institutionOnboardingReadiness,
      fallback: "institution-onboarding",
      referenceType: "governance",
      idKeys: ["onboardingReadinessId", "institutionOnboardingId", "id"],
      label: "Institutional onboarding governance reference",
      description: "Institutional onboarding readiness metadata",
      destination: "/institution-onboarding-readiness",
      blockedReason: "Institutional onboarding governance is blocked.",
    }),
  ];

  const privacyReferences = referencesFor({
    records: privacyReadiness,
    fallback: "privacy",
    referenceType: "privacy",
    idKeys: ["privacyReadinessId", "policyId", "identityLayerId", "id"],
    label: "Privacy and compliance posture reference",
    description: "Privacy and compliance posture metadata",
    destination: "/identity-layer",
    blockedReason: "Privacy or compliance posture is blocked.",
  });
  const consentReferences = referencesFor({
    records: consentGovernance,
    fallback: "consent",
    referenceType: "consent",
    idKeys: ["consentGovernanceId", "consentId", "identityConsentId", "id"],
    label: "Consent governance reference",
    description: "Consent governance and access-control metadata",
    destination: "/identity-layer",
    blockedReason: "Consent governance is missing or blocked.",
  });
  const auditReferences = referencesFor({
    records: auditLineage.slice(0, 20),
    fallback: "audit",
    referenceType: "audit",
    idKeys: ["eventId", "auditId", "id"],
    label: "Audit lineage reference",
    description: "Audit lineage metadata",
    destination: "/review-timeline",
    blockedReason: "Audit lineage is blocked.",
  });
  const verificationReferences = referencesFor({
    records: [...verificationReadiness, ...operationalRiskProfiles],
    fallback: "verification",
    referenceType: "verification",
    idKeys: ["verificationReadinessId", "identityProfileId", "participantId", "operationalRiskId", "id"],
    label: "Landlord and platform verification support reference",
    description: "Operational verification support metadata",
    destination: "/network-participants",
    blockedReason: "Verification support readiness is blocked.",
  });
  const interoperabilityReferences = referencesFor({
    records: interoperabilityReadiness,
    fallback: "interoperability",
    referenceType: "interoperability",
    idKeys: ["adapterReadinessId", "controlledIntegrationId", "id"],
    label: "Interoperability governance reference",
    description: "Interoperability governance metadata",
    destination: "/interoperability-adapters",
    blockedReason: "Interoperability governance is blocked.",
  });
  const evidenceReferences = referencesFor({
    records: evidencePacks,
    fallback: "evidence",
    referenceType: "evidence",
    idKeys: ["evidencePackId", "id"],
    label: "Evidence credentialing lineage reference",
    description: "Evidence lineage metadata",
    destination: "/evidence-packs",
    blockedReason: "Evidence lineage is blocked.",
  });
  const reviewReferences = referencesFor({
    records: reviews,
    fallback: "review",
    referenceType: "review",
    idKeys: ["reviewSessionId", "id"],
    label: "Review credentialing lineage reference",
    description: "Operator review lineage metadata",
    destination: "/review-timeline",
    blockedReason: "Review lineage is blocked.",
  });

  const allReferences = [
    ...governanceReferences,
    ...privacyReferences,
    ...consentReferences,
    ...auditReferences,
    ...verificationReferences,
    ...interoperabilityReferences,
    ...reviewReferences,
    ...evidenceReferences,
  ];
  const hasContext = Boolean(
    governanceReadiness.length ||
      privacyReadiness.length ||
      consentGovernance.length ||
      auditLineage.length ||
      verificationReadiness.length ||
      interoperabilityReadiness.length ||
      institutionOnboardingReadiness.length ||
      operationalRiskProfiles.length ||
      evidencePacks.length ||
      reviews.length
  );
  const status = readinessStatus(hasContext, allReferences);
  const credentialingRestrictions = allReferences
    .filter((reference) => reference.status !== "verified")
    .map((reference) =>
      credentialingRestriction({
        idParts: [reference.referenceType, reference.referenceId],
        restrictionType: reference.referenceType,
        status: reference.status === "blocked" ? "blocked" : "review_required",
        label: `${reference.label} restriction`,
        description: `${reference.label} is incomplete or blocked for platform credentialing readiness.`,
        blockedReason: reference.blockedReason,
      })
    );
  const blockedReasons = [...allReferences.map((reference) => reference.blockedReason), ...credentialingRestrictions.map((restriction) => restriction.blockedReason)].filter(Boolean) as string[];

  const canonicalEvents: PlatformCredentialingCanonicalEvent[] = [
    event({
      eventType: "platform_credentialing_readiness_derived",
      status,
      platformCredentialingId,
      summary:
        "Platform credentialing readiness derived from governance, privacy, consent, audit, verification, interoperability, review, and evidence metadata.",
    }),
    event({
      eventType: "platform_credentialing_redaction_applied",
      status,
      platformCredentialingId,
      summary:
        "CRA claims, bureau credentials, raw screening, bureau, government ID, payment, private tenant, and credential marketplace payloads were excluded.",
    }),
  ];
  if (credentialingRestrictions.length) {
    canonicalEvents.push(
      event({
        eventType: "platform_credentialing_restriction_detected",
        status,
        platformCredentialingId,
        summary: "Platform credentialing restrictions are visible for manual governance review.",
      })
    );
  }
  if (status === "review_required" || status === "partially_ready") {
    canonicalEvents.push(
      event({
        eventType: "platform_credentialing_review_required",
        status,
        platformCredentialingId,
        summary: "Manual platform credentialing review is required.",
      })
    );
  }
  if (status === "blocked") {
    canonicalEvents.push(
      event({
        eventType: "platform_credentialing_blocked",
        status,
        platformCredentialingId,
        summary: "Platform credentialing readiness is blocked by unresolved restrictions.",
      })
    );
  }

  return {
    platformCredentialingId,
    status,
    manualApprovalRequired: true,
    consumerReportingExecutionEnabled: false,
    autonomousCredentialApprovalEnabled: false,
    publicCredentialExposureEnabled: false,
    generatedAt: generatedAt(input.generatedAt),
    summary: {
      totalReferences: allReferences.length,
      verifiedReferences: allReferences.filter((reference) => reference.status === "verified").length,
      partiallyVerifiedReferences: allReferences.filter((reference) => reference.status === "partially_verified").length,
      blockedReferences: allReferences.filter((reference) => reference.status === "blocked").length,
      unavailableReferences: allReferences.filter((reference) => reference.status === "unavailable").length,
      restrictions: credentialingRestrictions.length,
    },
    governanceReferences,
    privacyReferences,
    consentReferences,
    auditReferences,
    verificationReferences,
    interoperabilityReferences,
    reviewReferences,
    evidenceReferences,
    credentialingRestrictions,
    redactions: REDACTIONS,
    blockedReasons,
    canonicalEvents,
  };
}
