import type {
  DeriveInstitutionOnboardingReadinessInput,
  InstitutionOnboardingCanonicalEvent,
  InstitutionOnboardingReadiness,
  InstitutionOnboardingReference,
  InstitutionOnboardingStatus,
  InstitutionType,
} from "./institutionOnboardingTypes";
import { institutionOnboardingIdPart, onboardingReference, onboardingRestriction } from "./onboardingRestrictionModels";

const INSTITUTION_TYPES = new Set<InstitutionType>(["lender", "insurer", "auditor", "regulator", "municipality", "institutional_landlord", "operational_partner"]);

const REDACTIONS = [
  "Raw government identifiers, screening, and credit bureau payloads are excluded.",
  "Payment account details and unrestricted financial information are excluded.",
  "Private tenant documents and tenant communications are excluded.",
  "Institution onboarding references are operational metadata, not external onboarding payloads.",
  "Public onboarding portals and unrestricted institutional directory data are not included.",
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

function normalizeInstitutionType(value: unknown): InstitutionType {
  const raw = asString(value, 80) as InstitutionType;
  return INSTITUTION_TYPES.has(raw) ? raw : "operational_partner";
}

function referenceId(record: Record<string, any>, keys: string[]): string {
  for (const key of keys) {
    const value = asString(record?.[key], 240);
    if (value) return value;
  }
  return asString(record?.id, 240);
}

function statusFromReferences(hasContext: boolean, references: InstitutionOnboardingReference[]): InstitutionOnboardingStatus {
  if (!hasContext) return "unknown";
  if (references.some((reference) => reference.status === "blocked")) return "blocked";
  if (references.some((reference) => reference.status === "unavailable")) return "review_required";
  if (references.some((reference) => reference.status === "partially_verified")) return "partially_ready";
  return "ready_for_review";
}

function event(input: {
  eventType: InstitutionOnboardingCanonicalEvent["eventType"];
  status: InstitutionOnboardingStatus;
  onboardingReadinessId: string;
  summary: string;
}): InstitutionOnboardingCanonicalEvent {
  return {
    eventType: input.eventType,
    action: input.eventType.replace(/^institution_onboarding_/, "").replace(/_/g, "."),
    status: input.status,
    resourceType: "institution_onboarding_readiness",
    resourceId: input.onboardingReadinessId,
    summary: input.summary,
  };
}

function statusFromReadyBlocked(record: Record<string, any>, readyStatuses: string[]): InstitutionOnboardingReference["status"] {
  const status = asString(record?.status, 80);
  if (status === "blocked") return "blocked";
  if (readyStatuses.includes(status)) return "verified";
  return "partially_verified";
}

export function deriveInstitutionOnboardingReadiness(input: DeriveInstitutionOnboardingReadinessInput): InstitutionOnboardingReadiness {
  const landlordId = asString(input.landlordId, 240);
  const institutionType = normalizeInstitutionType(input.institutionType);
  const onboardingReadinessId =
    institutionOnboardingIdPart(["institution_onboarding_readiness", landlordId || "unknown", institutionType].join(":")) || "institution_onboarding_readiness:unknown";

  const participants = asArray(input.networkParticipants);
  const trustRelationships = asArray(input.trustRelationships);
  const identityProfiles = asArray(input.identityProfiles);
  const evidencePacks = asArray(input.evidencePacks);
  const reviews = asArray(input.operatorReviewSessions);
  const regulatoryProfiles = asArray(input.regulatoryProfiles);
  const sharingRooms = asArray(input.sharingRooms);
  const auditEvents = asArray(input.auditEvents);
  const consentRecords = asArray(input.consentRecords);
  const settlementReadiness = input.settlementReadiness || null;

  const participantReferences = participants.length
    ? participants.map((participant) =>
        onboardingReference({
          idParts: ["participant", referenceId(participant, ["participantId", "id", "participantType"]) || institutionType],
          referenceType: "identity",
          status: participant.status === "verified" ? "verified" : participant.status === "blocked" ? "blocked" : "partially_verified",
          label: "Institution participant reference",
          description: "Network participant metadata is available for onboarding readiness review.",
          lineageReferences: [referenceId(participant, ["participantId", "id"])].filter(Boolean),
          destination: "/network-participants",
          blockedReason: participant.status === "blocked" ? "Institution participant relationship is blocked." : null,
        })
      )
    : [
        onboardingReference({
          idParts: ["participant", "missing"],
          referenceType: "identity",
          status: "unavailable",
          label: "Institution participant reference",
          description: "Institution participant metadata is unavailable.",
          destination: "/network-participants",
        }),
      ];

  const trustReferences = trustRelationships.length
    ? trustRelationships.map((trust) =>
        onboardingReference({
          idParts: ["trust", referenceId(trust, ["trustRelationshipId", "id", "relationshipType"]) || institutionType],
          referenceType: "trust",
          status: trust.status === "verified" ? "verified" : trust.status === "blocked" ? "blocked" : "partially_verified",
          label: "Trust relationship readiness",
          description: "Cross-organization trust lineage is available for onboarding readiness review.",
          lineageReferences: [referenceId(trust, ["trustRelationshipId", "id"])].filter(Boolean),
          destination: "/cross-organization-trust",
          blockedReason: trust.status === "blocked" ? "Cross-organization trust is blocked." : null,
        })
      )
    : [
        onboardingReference({
          idParts: ["trust", "missing"],
          referenceType: "trust",
          status: "unavailable",
          label: "Trust relationship readiness",
          description: "Cross-organization trust lineage is missing for onboarding readiness.",
          destination: "/cross-organization-trust",
        }),
      ];

  const identityReferences = identityProfiles.length
    ? identityProfiles.map((profile) =>
        onboardingReference({
          idParts: ["identity", referenceId(profile, ["identityId", "id"]) || institutionType],
          referenceType: "identity",
          status: profile.status === "verified" ? "verified" : profile.status === "blocked" ? "blocked" : "partially_verified",
          label: "Institution identity lineage",
          description: "Identity lineage is available for institution onboarding readiness.",
          lineageReferences: [referenceId(profile, ["identityId", "id"])].filter(Boolean),
          destination: "/identity-layer",
          blockedReason: profile.status === "blocked" ? "Identity lineage is blocked." : null,
        })
      )
    : [
        onboardingReference({
          idParts: ["identity", "missing"],
          referenceType: "identity",
          status: "unavailable",
          label: "Institution identity lineage",
          description: "Identity lineage is missing for institution onboarding readiness.",
          destination: "/identity-layer",
        }),
      ];

  const evidenceReferences = evidencePacks.length
    ? evidencePacks.map((pack) =>
        onboardingReference({
          idParts: ["evidence", referenceId(pack, ["evidencePackId", "id"]) || "unknown"],
          referenceType: "evidence",
          status: pack.status === "blocked" ? "blocked" : pack.status === "ready_for_review" ? "verified" : "partially_verified",
          label: "Evidence readiness lineage",
          description: "Evidence pack lineage is available for institution onboarding readiness.",
          lineageReferences: [referenceId(pack, ["evidencePackId", "id"])].filter(Boolean),
          destination: "/evidence-packs",
          blockedReason: pack.status === "blocked" ? "Evidence onboarding lineage is blocked." : null,
        })
      )
    : [
        onboardingReference({
          idParts: ["evidence", "missing"],
          referenceType: "evidence",
          status: "unavailable",
          label: "Evidence readiness lineage",
          description: "Evidence lineage is missing for institution onboarding readiness.",
          destination: "/evidence-packs",
        }),
      ];

  const reviewReferences = reviews.length
    ? reviews.map((review) =>
        onboardingReference({
          idParts: ["review", referenceId(review, ["reviewSessionId", "id"]) || "unknown"],
          referenceType: "review",
          status: review.status === "completed" ? "verified" : review.status === "blocked" ? "blocked" : "partially_verified",
          label: "Review readiness lineage",
          description: "Operator review lineage is available for institution onboarding readiness.",
          lineageReferences: [referenceId(review, ["reviewSessionId", "id"])].filter(Boolean),
          destination: "/review-timeline",
          blockedReason: review.status === "blocked" ? "Review onboarding lineage is blocked." : null,
        })
      )
    : [
        onboardingReference({
          idParts: ["review", "missing"],
          referenceType: "review",
          status: "unavailable",
          label: "Review readiness lineage",
          description: "Review lineage is missing for institution onboarding readiness.",
          destination: "/review-timeline",
        }),
      ];

  const settlementReferences = settlementReadiness
    ? [
        onboardingReference({
          idParts: ["settlement", referenceId(settlementReadiness, ["settlementReadinessId", "id"]) || "unknown"],
          referenceType: "settlement",
          status: statusFromReadyBlocked(settlementReadiness, ["ready_for_review"]),
          label: "Settlement onboarding dependency",
          description: "Settlement readiness metadata is available for institution onboarding readiness.",
          lineageReferences: [referenceId(settlementReadiness, ["settlementReadinessId", "id"])].filter(Boolean),
          destination: "/settlement-readiness",
          blockedReason: settlementReadiness.status === "blocked" ? "Settlement readiness is blocked." : null,
        }),
      ]
    : [
        onboardingReference({
          idParts: ["settlement", "missing"],
          referenceType: "settlement",
          status: "unavailable",
          label: "Settlement onboarding dependency",
          description: "Settlement readiness context is unavailable.",
          destination: "/settlement-readiness",
        }),
      ];

  const regulatoryReferences = regulatoryProfiles.length
    ? regulatoryProfiles.map((profile) =>
        onboardingReference({
          idParts: ["regulatory", referenceId(profile, ["regulatoryProfileId", "id"]) || "unknown"],
          referenceType: "regulatory",
          status: statusFromReadyBlocked(profile, ["ready_for_review"]),
          label: "Regulatory onboarding dependency",
          description: "Regulatory readiness metadata is available for institution onboarding readiness.",
          lineageReferences: [referenceId(profile, ["regulatoryProfileId", "id"])].filter(Boolean),
          destination: "/regulatory-profiles",
          blockedReason: profile.status === "blocked" ? "Regulatory readiness is blocked." : null,
        })
      )
    : [
        onboardingReference({
          idParts: ["regulatory", "missing"],
          referenceType: "regulatory",
          status: "unavailable",
          label: "Regulatory onboarding dependency",
          description: "Regulatory readiness context is unavailable.",
          destination: "/regulatory-profiles",
        }),
      ];

  const sharingReferences = sharingRooms.length
    ? sharingRooms.map((room) =>
        onboardingReference({
          idParts: ["sharing", referenceId(room, ["sharingRoomId", "id"]) || "unknown"],
          referenceType: "sharing",
          status: room.publiclyAccessible || room.externalExecutionEnabled || room.status === "blocked" ? "blocked" : room.status === "active" ? "verified" : "partially_verified",
          label: "Institutional sharing onboarding dependency",
          description: "Permissioned sharing-room metadata is available for onboarding readiness.",
          lineageReferences: [referenceId(room, ["sharingRoomId", "id"])].filter(Boolean),
          destination: "/institutional-sharing-rooms",
          blockedReason: room.publiclyAccessible || room.externalExecutionEnabled ? "Public access or external execution is not allowed for institution onboarding." : null,
        })
      )
    : [
        onboardingReference({
          idParts: ["sharing", "missing"],
          referenceType: "sharing",
          status: consentRecords.length ? "partially_verified" : "blocked",
          label: "Institutional sharing onboarding dependency",
          description: "Institutional onboarding requires permissioned sharing or consent/access lineage.",
          destination: "/institutional-sharing-rooms",
          blockedReason: consentRecords.length ? null : "Consent/access lineage is missing for institution onboarding.",
        }),
      ];

  const auditReferences = auditEvents.length
    ? auditEvents.slice(0, 12).map((record) =>
        onboardingReference({
          idParts: ["audit", referenceId(record, ["eventId", "id"]) || "unknown"],
          referenceType: "audit",
          status: record.redacted ? "partially_verified" : "verified",
          label: "Audit onboarding lineage",
          description: "Canonical audit event metadata is available for institution onboarding readiness.",
          lineageReferences: [referenceId(record, ["eventId", "id"])].filter(Boolean),
          destination: "/review-timeline",
          redacted: Boolean(record.redacted),
          redactionReason: record.redacted ? "Audit payload is redacted for onboarding safety." : null,
        })
      )
    : [
        onboardingReference({
          idParts: ["audit", "missing"],
          referenceType: "audit",
          status: "unavailable",
          label: "Audit onboarding lineage",
          description: "Audit lineage is missing for institution onboarding readiness.",
          destination: "/review-timeline",
        }),
      ];

  const allReferences = [
    ...participantReferences,
    ...trustReferences,
    ...identityReferences,
    ...evidenceReferences,
    ...reviewReferences,
    ...settlementReferences,
    ...regulatoryReferences,
    ...sharingReferences,
    ...auditReferences,
  ];

  const onboardingRestrictions = [
    ...(consentRecords.length
      ? []
      : [
          onboardingRestriction({
            idParts: ["consent", "missing"],
            restrictionType: "consent",
            status: "blocked",
            label: "Consent/access lineage missing",
            description: "Institution onboarding readiness requires consent or access lineage before operational reliance.",
            blockedReason: "Consent/access lineage is missing.",
          }),
        ]),
    ...trustReferences
      .filter((reference) => reference.status !== "verified")
      .map((reference) =>
        onboardingRestriction({
          idParts: ["trust", reference.referenceId],
          restrictionType: "trust",
          status: reference.status === "blocked" ? "blocked" : "review_required",
          label: "Trust onboarding restriction",
          description: "Trust relationship readiness is incomplete or blocked.",
          blockedReason: reference.blockedReason,
        })
      ),
    ...settlementReferences
      .filter((reference) => reference.status !== "verified")
      .map((reference) =>
        onboardingRestriction({
          idParts: ["settlement", reference.referenceId],
          restrictionType: "settlement",
          status: reference.status === "blocked" ? "blocked" : "review_required",
          label: "Settlement onboarding restriction",
          description: "Settlement readiness is incomplete or blocked.",
          blockedReason: reference.blockedReason,
        })
      ),
    ...regulatoryReferences
      .filter((reference) => reference.status !== "verified")
      .map((reference) =>
        onboardingRestriction({
          idParts: ["regulatory", reference.referenceId],
          restrictionType: "regulatory",
          status: reference.status === "blocked" ? "blocked" : "review_required",
          label: "Regulatory onboarding restriction",
          description: "Regulatory readiness is incomplete or blocked.",
          blockedReason: reference.blockedReason,
        })
      ),
  ];

  const hasContext = Boolean(
    landlordId &&
      (participants.length || trustRelationships.length || identityProfiles.length || evidencePacks.length || reviews.length || settlementReadiness || regulatoryProfiles.length || sharingRooms.length || auditEvents.length)
  );
  const status = statusFromReferences(hasContext, allReferences);
  const blockedReasons = [...allReferences.map((reference) => reference.blockedReason), ...onboardingRestrictions.map((restriction) => restriction.blockedReason)].filter(Boolean) as string[];

  const canonicalEvents: InstitutionOnboardingCanonicalEvent[] = [
    event({
      eventType: "institution_onboarding_readiness_derived",
      status,
      onboardingReadinessId,
      summary: "Institution onboarding readiness derived from participant, trust, identity, review, evidence, settlement, regulatory, sharing, and audit metadata.",
    }),
    event({
      eventType: "institution_onboarding_redaction_applied",
      status,
      onboardingReadinessId,
      summary: "Sensitive identity, screening, payment, private document, tenant communication, and external onboarding payloads were excluded.",
    }),
  ];
  if (onboardingRestrictions.length) {
    canonicalEvents.push(
      event({
        eventType: "institution_onboarding_restriction_detected",
        status,
        onboardingReadinessId,
        summary: "Institution onboarding restrictions are visible for manual review.",
      })
    );
  }
  if (status === "review_required" || status === "partially_ready") {
    canonicalEvents.push(
      event({
        eventType: "institution_onboarding_review_required",
        status,
        onboardingReadinessId,
        summary: "Manual institution onboarding readiness review is required.",
      })
    );
  }
  if (status === "blocked") {
    canonicalEvents.push(
      event({
        eventType: "institution_onboarding_blocked",
        status,
        onboardingReadinessId,
        summary: "Institution onboarding readiness is blocked by unsafe or missing required lineage.",
      })
    );
  }

  return {
    onboardingReadinessId,
    institutionType,
    status,
    manualReviewRequired: true,
    externalOnboardingEnabled: false,
    autonomousApprovalEnabled: false,
    generatedAt: generatedAt(input.generatedAt),
    summary: {
      totalReferences: allReferences.length,
      verifiedReferences: allReferences.filter((reference) => reference.status === "verified").length,
      partiallyVerifiedReferences: allReferences.filter((reference) => reference.status === "partially_verified").length,
      blockedReferences: allReferences.filter((reference) => reference.status === "blocked").length,
      unavailableReferences: allReferences.filter((reference) => reference.status === "unavailable").length,
      restrictions: onboardingRestrictions.length,
    },
    participantReferences,
    trustReferences,
    identityReferences,
    evidenceReferences,
    reviewReferences,
    settlementReferences,
    regulatoryReferences,
    sharingReferences,
    auditReferences,
    onboardingRestrictions,
    redactions: REDACTIONS,
    blockedReasons,
    canonicalEvents,
  };
}
