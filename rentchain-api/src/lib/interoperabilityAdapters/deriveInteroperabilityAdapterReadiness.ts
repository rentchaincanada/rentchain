import type {
  DeriveInteroperabilityAdapterReadinessInput,
  InteroperabilityAdapterCanonicalEvent,
  InteroperabilityAdapterReadiness,
  InteroperabilityAdapterReference,
  InteroperabilityAdapterStatus,
  InteroperabilityAdapterType,
} from "./interoperabilityAdapterTypes";
import { adapterReference, adapterRestriction, interoperabilityAdapterIdPart } from "./adapterRestrictionModels";

const ADAPTER_TYPES = new Set<InteroperabilityAdapterType>(["lender", "insurer", "regulator", "registry", "accounting", "payment_provider", "operational_partner"]);

const REDACTIONS = [
  "Live integration credentials, webhook secrets, and external API payloads are excluded.",
  "Raw government identifiers, screening, credit bureau, payment account, and private tenant payloads are excluded.",
  "Unrestricted external exports, unrestricted financial information, and unrestricted audit histories are excluded.",
  "Interoperability adapters are readiness metadata only; no external synchronization or execution is enabled.",
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

function normalizeAdapterType(value: unknown): InteroperabilityAdapterType {
  const raw = asString(value, 80) as InteroperabilityAdapterType;
  return ADAPTER_TYPES.has(raw) ? raw : "operational_partner";
}

function referenceId(record: Record<string, any>, keys: string[]): string {
  for (const key of keys) {
    const value = asString(record?.[key], 240);
    if (value) return value;
  }
  return asString(record?.id, 240);
}

function readinessStatus(hasContext: boolean, references: InteroperabilityAdapterReference[]): InteroperabilityAdapterStatus {
  if (!hasContext) return "unknown";
  if (references.some((reference) => reference.status === "blocked")) return "blocked";
  if (references.some((reference) => reference.status === "unavailable")) return "review_required";
  if (references.some((reference) => reference.status === "partially_verified")) return "partially_ready";
  return "ready_for_review";
}

function event(input: {
  eventType: InteroperabilityAdapterCanonicalEvent["eventType"];
  status: InteroperabilityAdapterStatus;
  adapterReadinessId: string;
  summary: string;
}): InteroperabilityAdapterCanonicalEvent {
  return {
    eventType: input.eventType,
    action: input.eventType.replace(/^interoperability_adapter_/, "").replace(/_/g, "."),
    status: input.status,
    resourceType: "interoperability_adapter_readiness",
    resourceId: input.adapterReadinessId,
    summary: input.summary,
  };
}

function statusFromReadyBlocked(record: Record<string, any>, readyStatuses: string[]): InteroperabilityAdapterReference["status"] {
  const status = asString(record?.status, 80);
  if (status === "blocked") return "blocked";
  if (readyStatuses.includes(status)) return "verified";
  if (status === "unknown") return "unavailable";
  return "partially_verified";
}

export function deriveInteroperabilityAdapterReadiness(input: DeriveInteroperabilityAdapterReadinessInput): InteroperabilityAdapterReadiness {
  const landlordId = asString(input.landlordId, 240);
  const adapterType = normalizeAdapterType(input.adapterType);
  const adapterReadinessId =
    interoperabilityAdapterIdPart(["interoperability_adapter_readiness", landlordId || "unknown", adapterType].join(":")) ||
    "interoperability_adapter_readiness:unknown";

  const operationalRiskProfiles = asArray(input.operationalRiskProfiles);
  const onboardingReadiness = asArray(input.institutionOnboardingReadiness);
  const trustRelationships = asArray(input.trustRelationships);
  const sharingRooms = asArray(input.sharingRooms);
  const regulatoryProfiles = asArray(input.regulatoryProfiles);
  const evidencePacks = asArray(input.evidencePacks);
  const reviews = asArray(input.operatorReviewSessions);
  const auditEvents = asArray(input.auditEvents);
  const settlementReadiness = input.settlementReadiness || null;

  const compatibilitySources = [...operationalRiskProfiles, ...onboardingReadiness, ...trustRelationships];
  const compatibilityReferences = compatibilitySources.length
    ? compatibilitySources.map((record, index) => {
        const id = referenceId(record, ["operationalRiskId", "onboardingReadinessId", "trustRelationshipId", "id"]) || String(index);
        const status = record.status === "stable" || record.status === "ready_for_review" || record.status === "verified" ? "verified" : record.status === "blocked" ? "blocked" : "partially_verified";
        return adapterReference({
          idParts: ["compatibility", id],
          referenceType: "compatibility",
          status,
          label: "Compatibility readiness reference",
          description: "Operational compatibility metadata is available for interoperability readiness review.",
          lineageReferences: [id].filter(Boolean),
          destination: record.operationalRiskId ? "/operational-risk" : record.onboardingReadinessId ? "/institution-onboarding-readiness" : "/cross-organization-trust",
          blockedReason: status === "blocked" ? "Compatibility readiness is blocked by operational restrictions." : null,
        });
      })
    : [
        adapterReference({
          idParts: ["compatibility", "missing"],
          referenceType: "compatibility",
          status: "unavailable",
          label: "Compatibility readiness reference",
          description: "Operational compatibility metadata is unavailable.",
          destination: "/operational-risk",
        }),
      ];

  const settlementReferences = settlementReadiness
    ? [
        adapterReference({
          idParts: ["settlement", referenceId(settlementReadiness, ["settlementReadinessId", "id"]) || "unknown"],
          referenceType: "settlement",
          status: statusFromReadyBlocked(settlementReadiness, ["ready_for_review"]),
          label: "Settlement interoperability dependency",
          description: "Settlement readiness metadata is available for interoperability readiness review.",
          lineageReferences: [referenceId(settlementReadiness, ["settlementReadinessId", "id"])].filter(Boolean),
          destination: "/settlement-readiness",
          blockedReason: settlementReadiness.status === "blocked" ? "Settlement readiness is blocked." : null,
        }),
      ]
    : [
        adapterReference({
          idParts: ["settlement", "missing"],
          referenceType: "settlement",
          status: "unavailable",
          label: "Settlement interoperability dependency",
          description: "Settlement readiness metadata is unavailable.",
          destination: "/settlement-readiness",
        }),
      ];

  const regulatoryReferences = regulatoryProfiles.length
    ? regulatoryProfiles.map((profile) =>
        adapterReference({
          idParts: ["regulatory", referenceId(profile, ["regulatoryProfileId", "id"]) || "unknown"],
          referenceType: "regulatory",
          status: statusFromReadyBlocked(profile, ["ready_for_review"]),
          label: "Regulatory interoperability dependency",
          description: "Regulatory readiness metadata is available for interoperability readiness review.",
          lineageReferences: [referenceId(profile, ["regulatoryProfileId", "id"])].filter(Boolean),
          destination: "/regulatory-profiles",
          blockedReason: profile.status === "blocked" ? "Regulatory readiness is blocked." : null,
        })
      )
    : [
        adapterReference({
          idParts: ["regulatory", "missing"],
          referenceType: "regulatory",
          status: "unavailable",
          label: "Regulatory interoperability dependency",
          description: "Regulatory readiness metadata is unavailable.",
          destination: "/regulatory-profiles",
        }),
      ];

  const evidenceReferences = evidencePacks.length
    ? evidencePacks.map((pack) =>
        adapterReference({
          idParts: ["evidence", referenceId(pack, ["evidencePackId", "id"]) || "unknown"],
          referenceType: "evidence",
          status: pack.status === "blocked" ? "blocked" : pack.status === "ready_for_review" ? "verified" : "partially_verified",
          label: "Evidence interoperability lineage",
          description: "Evidence pack lineage is available for interoperability readiness review.",
          lineageReferences: [referenceId(pack, ["evidencePackId", "id"])].filter(Boolean),
          destination: "/evidence-packs",
          blockedReason: pack.status === "blocked" ? "Evidence interoperability lineage is blocked." : null,
        })
      )
    : [
        adapterReference({
          idParts: ["evidence", "missing"],
          referenceType: "evidence",
          status: "unavailable",
          label: "Evidence interoperability lineage",
          description: "Evidence pack lineage is unavailable.",
          destination: "/evidence-packs",
        }),
      ];

  const reviewReferences = reviews.length
    ? reviews.map((review) =>
        adapterReference({
          idParts: ["review", referenceId(review, ["reviewSessionId", "id"]) || "unknown"],
          referenceType: "review",
          status: review.status === "completed" ? "verified" : review.status === "blocked" ? "blocked" : "partially_verified",
          label: "Review interoperability lineage",
          description: "Operator review lineage is available for interoperability readiness review.",
          lineageReferences: [referenceId(review, ["reviewSessionId", "id"])].filter(Boolean),
          destination: "/review-timeline",
          blockedReason: review.status === "blocked" ? "Review interoperability lineage is blocked." : null,
        })
      )
    : [
        adapterReference({
          idParts: ["review", "missing"],
          referenceType: "review",
          status: "unavailable",
          label: "Review interoperability lineage",
          description: "Operator review lineage is unavailable.",
          destination: "/review-timeline",
        }),
      ];

  const sharingReferences = sharingRooms.length
    ? sharingRooms.map((room) =>
        adapterReference({
          idParts: ["sharing", referenceId(room, ["sharingRoomId", "id"]) || "unknown"],
          referenceType: "sharing",
          status: room.publiclyAccessible || room.externalExecutionEnabled || room.status === "blocked" ? "blocked" : room.status === "active" ? "verified" : "partially_verified",
          label: "Sharing interoperability boundary",
          description: "Institutional sharing metadata is available as a reviewable interoperability boundary.",
          lineageReferences: [referenceId(room, ["sharingRoomId", "id"])].filter(Boolean),
          destination: "/institutional-sharing-rooms",
          blockedReason: room.publiclyAccessible || room.externalExecutionEnabled ? "Public access or external execution is not allowed for interoperability readiness." : null,
        })
      )
    : [
        adapterReference({
          idParts: ["sharing", "missing"],
          referenceType: "sharing",
          status: "unavailable",
          label: "Sharing interoperability boundary",
          description: "Institutional sharing metadata is unavailable.",
          destination: "/institutional-sharing-rooms",
        }),
      ];

  const auditReferences = auditEvents.length
    ? auditEvents.slice(0, 12).map((record) =>
        adapterReference({
          idParts: ["audit", referenceId(record, ["eventId", "id"]) || "unknown"],
          referenceType: "audit",
          status: record.redacted ? "partially_verified" : "verified",
          label: "Audit interoperability lineage",
          description: "Canonical audit event metadata is available for interoperability readiness review.",
          lineageReferences: [referenceId(record, ["eventId", "id"])].filter(Boolean),
          destination: "/review-timeline",
          redacted: Boolean(record.redacted),
          redactionReason: record.redacted ? "Audit payload is redacted for interoperability safety." : null,
        })
      )
    : [
        adapterReference({
          idParts: ["audit", "missing"],
          referenceType: "audit",
          status: "unavailable",
          label: "Audit interoperability lineage",
          description: "Canonical audit event metadata is unavailable.",
          destination: "/review-timeline",
        }),
      ];

  const allReferences = [
    ...compatibilityReferences,
    ...settlementReferences,
    ...regulatoryReferences,
    ...evidenceReferences,
    ...reviewReferences,
    ...sharingReferences,
    ...auditReferences,
  ];

  const adapterRestrictions = [
    ...allReferences
      .filter((reference) => reference.status !== "verified")
      .map((reference) =>
        adapterRestriction({
          idParts: [reference.referenceType, reference.referenceId],
          restrictionType: reference.referenceType === "compatibility" ? "compatibility" : reference.referenceType,
          status: reference.status === "blocked" ? "blocked" : "review_required",
          label: `${reference.label} restriction`,
          description: `${reference.label} is incomplete or blocked for interoperability readiness.`,
          blockedReason: reference.blockedReason,
        })
      ),
  ];

  const hasContext = Boolean(
    landlordId &&
      (compatibilitySources.length || settlementReadiness || regulatoryProfiles.length || evidencePacks.length || reviews.length || sharingRooms.length || auditEvents.length)
  );
  const status = readinessStatus(hasContext, allReferences);
  const blockedReasons = [...allReferences.map((reference) => reference.blockedReason), ...adapterRestrictions.map((restriction) => restriction.blockedReason)].filter(Boolean) as string[];

  const canonicalEvents: InteroperabilityAdapterCanonicalEvent[] = [
    event({
      eventType: "interoperability_adapter_readiness_derived",
      status,
      adapterReadinessId,
      summary: "Interoperability adapter readiness derived from compatibility, settlement, regulatory, evidence, review, sharing, and audit metadata.",
    }),
    event({
      eventType: "interoperability_adapter_redaction_applied",
      status,
      adapterReadinessId,
      summary: "Integration credentials, webhook secrets, external payloads, sensitive identity, screening, credit, payment, and private tenant payloads were excluded.",
    }),
  ];
  if (adapterRestrictions.length) {
    canonicalEvents.push(
      event({
        eventType: "interoperability_adapter_restriction_detected",
        status,
        adapterReadinessId,
        summary: "Interoperability adapter restrictions are visible for manual review.",
      })
    );
  }
  if (status === "review_required" || status === "partially_ready") {
    canonicalEvents.push(
      event({
        eventType: "interoperability_adapter_review_required",
        status,
        adapterReadinessId,
        summary: "Manual interoperability readiness review is required.",
      })
    );
  }
  if (status === "blocked") {
    canonicalEvents.push(
      event({
        eventType: "interoperability_adapter_blocked",
        status,
        adapterReadinessId,
        summary: "Interoperability readiness is blocked by unsafe or missing required lineage.",
      })
    );
  }

  return {
    adapterReadinessId,
    adapterType,
    status,
    manualReviewRequired: true,
    liveIntegrationEnabled: false,
    externalSynchronizationEnabled: false,
    generatedAt: generatedAt(input.generatedAt),
    summary: {
      totalReferences: allReferences.length,
      verifiedReferences: allReferences.filter((reference) => reference.status === "verified").length,
      partiallyVerifiedReferences: allReferences.filter((reference) => reference.status === "partially_verified").length,
      blockedReferences: allReferences.filter((reference) => reference.status === "blocked").length,
      unavailableReferences: allReferences.filter((reference) => reference.status === "unavailable").length,
      restrictions: adapterRestrictions.length,
    },
    compatibilityReferences,
    settlementReferences,
    regulatoryReferences,
    evidenceReferences,
    reviewReferences,
    sharingReferences,
    auditReferences,
    adapterRestrictions,
    redactions: REDACTIONS,
    blockedReasons,
    canonicalEvents,
  };
}
