import type {
  CrossOrganizationTrustCanonicalEvent,
  CrossOrganizationTrustReference,
  CrossOrganizationTrustRelationship,
  CrossOrganizationTrustRelationshipType,
  CrossOrganizationTrustStatus,
  DeriveCrossOrganizationTrustInput,
} from "./crossOrganizationTrustTypes";
import { crossOrganizationTrustIdPart, trustReference, trustRestriction } from "./trustRestrictionModels";

const RELATIONSHIP_TYPES = new Set<CrossOrganizationTrustRelationshipType>([
  "operational_trust",
  "evidence_trust",
  "review_trust",
  "settlement_trust",
  "regulatory_trust",
  "sharing_trust",
]);

const REDACTIONS = [
  "Public reputation scores and participant rankings are excluded.",
  "Raw government identifiers, screening, and credit bureau payloads are excluded.",
  "Payment account details and unrestricted financial information are excluded.",
  "Unrestricted audit histories and private tenant communications are excluded.",
  "Trust relationships are operational references, not public trust exposure.",
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

function normalizeRelationshipType(value: unknown): CrossOrganizationTrustRelationshipType {
  const raw = asString(value, 80) as CrossOrganizationTrustRelationshipType;
  return RELATIONSHIP_TYPES.has(raw) ? raw : "operational_trust";
}

function statusFromReferences(hasContext: boolean, references: CrossOrganizationTrustReference[]): CrossOrganizationTrustStatus {
  if (!hasContext) return "unknown";
  if (references.some((reference) => reference.status === "blocked")) return "blocked";
  if (references.some((reference) => reference.status === "unavailable")) return "review_required";
  if (references.some((reference) => reference.status === "partially_verified")) return "partially_verified";
  return "verified";
}

function event(input: {
  eventType: CrossOrganizationTrustCanonicalEvent["eventType"];
  status: CrossOrganizationTrustStatus;
  trustRelationshipId: string;
  summary: string;
}): CrossOrganizationTrustCanonicalEvent {
  return {
    eventType: input.eventType,
    action: input.eventType.replace(/^cross_organization_/, "").replace(/_/g, "."),
    status: input.status,
    resourceType: "cross_organization_trust",
    resourceId: input.trustRelationshipId,
    summary: input.summary,
  };
}

export function deriveCrossOrganizationTrust(input: DeriveCrossOrganizationTrustInput): CrossOrganizationTrustRelationship {
  const landlordId = asString(input.landlordId, 240);
  const relationshipType = normalizeRelationshipType(input.relationshipType);
  const trustRelationshipId =
    crossOrganizationTrustIdPart(["cross_organization_trust", landlordId || "unknown", relationshipType].join(":")) || "cross_organization_trust:unknown";

  const participants = asArray(input.networkParticipants);
  const evidencePacks = asArray(input.evidencePacks);
  const reviews = asArray(input.operatorReviewSessions);
  const regulatoryProfiles = asArray(input.regulatoryProfiles);
  const sharingRooms = asArray(input.sharingRooms);
  const auditEvents = asArray(input.auditEvents);
  const consentRecords = asArray(input.consentRecords);
  const settlementReadiness = input.settlementReadiness || null;

  const participantReferences = participants.map((participant) => asString(participant.participantId || participant.id, 240)).filter(Boolean);

  const evidenceReferences = evidencePacks.length
    ? evidencePacks.map((pack) =>
        trustReference({
          idParts: ["evidence", pack.evidencePackId || pack.id || "unknown"],
          referenceType: "evidence",
          status: pack.status === "blocked" ? "blocked" : "verified",
          label: "Evidence trust lineage",
          description: "Evidence pack lineage is available for operational trust review.",
          lineageReferences: [asString(pack.evidencePackId || pack.id, 240)].filter(Boolean),
          destination: "/evidence-packs",
          blockedReason: pack.status === "blocked" ? "Evidence trust lineage is blocked." : null,
        })
      )
    : [
        trustReference({
          idParts: ["evidence", "missing"],
          referenceType: "evidence",
          status: "unavailable",
          label: "Evidence trust lineage",
          description: "Evidence lineage is missing for this trust relationship.",
          destination: "/evidence-packs",
        }),
      ];

  const reviewReferences = reviews.length
    ? reviews.map((review) =>
        trustReference({
          idParts: ["review", review.reviewSessionId || review.id || "unknown"],
          referenceType: "review",
          status: review.status === "completed" ? "verified" : review.status === "blocked" ? "blocked" : "partially_verified",
          label: "Review trust lineage",
          description: "Operator review lineage is available for operational trust review.",
          lineageReferences: [asString(review.reviewSessionId || review.id, 240)].filter(Boolean),
          destination: "/review-timeline",
          blockedReason: review.status === "blocked" ? "Review trust lineage is blocked." : null,
        })
      )
    : [
        trustReference({
          idParts: ["review", "missing"],
          referenceType: "review",
          status: "unavailable",
          label: "Review trust lineage",
          description: "Review lineage is missing for this trust relationship.",
          destination: "/review-timeline",
        }),
      ];

  const settlementReferences = settlementReadiness
    ? [
        trustReference({
          idParts: ["settlement", settlementReadiness.settlementReadinessId || "unknown"],
          referenceType: "settlement",
          status: settlementReadiness.status === "ready_for_review" ? "verified" : settlementReadiness.status === "blocked" ? "blocked" : "partially_verified",
          label: "Settlement trust reference",
          description: "Settlement readiness metadata is available for operational trust review.",
          lineageReferences: [asString(settlementReadiness.settlementReadinessId, 240)].filter(Boolean),
          destination: "/settlement-readiness",
          blockedReason: settlementReadiness.status === "blocked" ? "Settlement readiness is blocked." : null,
        }),
      ]
    : [
        trustReference({
          idParts: ["settlement", "missing"],
          referenceType: "settlement",
          status: "unavailable",
          label: "Settlement trust reference",
          description: "Settlement readiness context is unavailable.",
          destination: "/settlement-readiness",
        }),
      ];

  const regulatoryReferences = regulatoryProfiles.length
    ? regulatoryProfiles.map((profile) =>
        trustReference({
          idParts: ["regulatory", profile.regulatoryProfileId || profile.id || "unknown"],
          referenceType: "regulatory",
          status: profile.status === "ready_for_review" ? "verified" : profile.status === "blocked" ? "blocked" : "partially_verified",
          label: "Regulatory trust reference",
          description: "Regulatory readiness metadata is available for operational trust review.",
          lineageReferences: [asString(profile.regulatoryProfileId || profile.id, 240)].filter(Boolean),
          destination: "/regulatory-profiles",
          blockedReason: profile.status === "blocked" ? "Regulatory readiness is blocked." : null,
        })
      )
    : [
        trustReference({
          idParts: ["regulatory", "missing"],
          referenceType: "regulatory",
          status: "unavailable",
          label: "Regulatory trust reference",
          description: "Regulatory readiness context is unavailable.",
          destination: "/regulatory-profiles",
        }),
      ];

  const sharingReferences = sharingRooms.length
    ? sharingRooms.map((room) =>
        trustReference({
          idParts: ["sharing", room.sharingRoomId || room.id || "unknown"],
          referenceType: "sharing",
          status: room.publiclyAccessible || room.externalExecutionEnabled || room.status === "blocked" ? "blocked" : room.status === "active" ? "verified" : "partially_verified",
          label: "Institutional sharing trust reference",
          description: "Permissioned sharing-room metadata is available for trust review.",
          lineageReferences: [asString(room.sharingRoomId || room.id, 240)].filter(Boolean),
          destination: "/institutional-sharing-rooms",
          blockedReason: room.publiclyAccessible || room.externalExecutionEnabled ? "Public access or external execution is not allowed for trust relationships." : null,
        })
      )
    : [
        trustReference({
          idParts: ["sharing", "missing"],
          referenceType: "sharing",
          status: consentRecords.length ? "partially_verified" : "blocked",
          label: "Institutional sharing trust reference",
          description: "Institutional sharing trust requires consent/access lineage.",
          destination: "/institutional-sharing-rooms",
          blockedReason: consentRecords.length ? null : "Consent/access lineage is missing for sharing trust.",
        }),
      ];

  const auditReferences = auditEvents.length
    ? auditEvents.slice(0, 12).map((record) =>
        trustReference({
          idParts: ["audit", record.eventId || record.id || "unknown"],
          referenceType: "audit",
          status: record.redacted ? "partially_verified" : "verified",
          label: "Audit trust lineage",
          description: "Canonical audit event metadata is available for trust review.",
          lineageReferences: [asString(record.eventId || record.id, 240)].filter(Boolean),
          destination: "/review-timeline",
          redacted: Boolean(record.redacted),
          redactionReason: record.redacted ? "Audit payload is redacted for trust safety." : null,
        })
      )
    : [
        trustReference({
          idParts: ["audit", "missing"],
          referenceType: "audit",
          status: "unavailable",
          label: "Audit trust lineage",
          description: "Audit lineage is missing for this trust relationship.",
          destination: "/review-timeline",
        }),
      ];

  const operationalReferences = participants.length
    ? participants.map((participant) =>
        trustReference({
          idParts: ["operational", participant.participantId || participant.id || participant.participantType || "unknown"],
          referenceType: "operational",
          status: participant.status === "blocked" ? "blocked" : participant.status === "verified" ? "verified" : "partially_verified",
          label: "Operational participant trust boundary",
          description: "Network participant metadata is available as operational trust context.",
          lineageReferences: [asString(participant.participantId || participant.id, 240)].filter(Boolean),
          destination: "/network-participants",
          blockedReason: participant.status === "blocked" ? "Network participant relationship is blocked." : null,
        })
      )
    : [
        trustReference({
          idParts: ["operational", "missing"],
          referenceType: "operational",
          status: "unavailable",
          label: "Operational participant trust boundary",
          description: "Network participant context is unavailable.",
          destination: "/network-participants",
        }),
      ];

  const allReferences = [
    ...evidenceReferences,
    ...reviewReferences,
    ...settlementReferences,
    ...regulatoryReferences,
    ...sharingReferences,
    ...auditReferences,
    ...operationalReferences,
  ];

  const trustRestrictions = [
    ...(consentRecords.length
      ? []
      : [
          trustRestriction({
            idParts: ["consent", "missing"],
            restrictionType: "consent",
            status: "blocked",
            label: "Consent/access lineage missing",
            description: "Permissioned trust requires consent or access lineage before relying on the relationship.",
            blockedReason: "Consent/access lineage is missing.",
          }),
        ]),
    ...settlementReferences
      .filter((reference) => reference.status !== "verified")
      .map((reference) =>
        trustRestriction({
          idParts: ["settlement", reference.trustReferenceId],
          restrictionType: "settlement",
          status: reference.status === "blocked" ? "blocked" : "review_required",
          label: "Settlement trust restriction",
          description: "Settlement readiness is incomplete or blocked.",
          blockedReason: reference.blockedReason,
        })
      ),
    ...regulatoryReferences
      .filter((reference) => reference.status !== "verified")
      .map((reference) =>
        trustRestriction({
          idParts: ["regulatory", reference.trustReferenceId],
          restrictionType: "regulatory",
          status: reference.status === "blocked" ? "blocked" : "review_required",
          label: "Regulatory trust restriction",
          description: "Regulatory readiness is incomplete or blocked.",
          blockedReason: reference.blockedReason,
        })
      ),
  ];

  const relationshipReferences =
    relationshipType === "evidence_trust"
      ? evidenceReferences
      : relationshipType === "review_trust"
        ? reviewReferences
        : relationshipType === "settlement_trust"
          ? settlementReferences
          : relationshipType === "regulatory_trust"
            ? regulatoryReferences
            : relationshipType === "sharing_trust"
              ? sharingReferences
              : allReferences;
  const hasContext = Boolean(landlordId && (participants.length || evidencePacks.length || reviews.length || settlementReadiness || regulatoryProfiles.length || sharingRooms.length || auditEvents.length));
  const status = statusFromReferences(hasContext, relationshipReferences);
  const blockedReasons = [...relationshipReferences.map((reference) => reference.blockedReason), ...trustRestrictions.map((restriction) => restriction.blockedReason)].filter(Boolean) as string[];

  const canonicalEvents: CrossOrganizationTrustCanonicalEvent[] = [
    event({
      eventType: "cross_organization_trust_derived",
      status,
      trustRelationshipId,
      summary: "Cross-organization trust relationship derived from participant, review, evidence, settlement, regulatory, sharing, and audit metadata.",
    }),
    event({
      eventType: "cross_organization_trust_redaction_applied",
      status,
      trustRelationshipId,
      summary: "Public reputation, raw identity, screening, payment, audit, and tenant communication payloads were excluded.",
    }),
  ];
  if (status === "verified") {
    canonicalEvents.push(
      event({
        eventType: "cross_organization_trust_verified",
        status,
        trustRelationshipId,
        summary: "Trust relationship has verified operational lineage references.",
      })
    );
  }
  if (status === "review_required" || status === "partially_verified") {
    canonicalEvents.push(
      event({
        eventType: "cross_organization_trust_review_required",
        status,
        trustRelationshipId,
        summary: "Manual trust relationship review is required.",
      })
    );
  }
  if (status === "blocked") {
    canonicalEvents.push(
      event({
        eventType: "cross_organization_trust_blocked",
        status,
        trustRelationshipId,
        summary: "Cross-organization trust relationship is blocked by unsafe or missing required lineage.",
      })
    );
  }

  return {
    trustRelationshipId,
    relationshipType,
    status,
    manualReviewRequired: true,
    publicTrustExposureEnabled: false,
    autonomousTrustApprovalEnabled: false,
    generatedAt: generatedAt(input.generatedAt),
    summary: {
      totalReferences: relationshipReferences.length,
      verifiedReferences: relationshipReferences.filter((reference) => reference.status === "verified").length,
      partiallyVerifiedReferences: relationshipReferences.filter((reference) => reference.status === "partially_verified").length,
      blockedReferences: relationshipReferences.filter((reference) => reference.status === "blocked").length,
      unavailableReferences: relationshipReferences.filter((reference) => reference.status === "unavailable").length,
      restrictions: trustRestrictions.length,
    },
    participantReferences,
    reviewReferences,
    evidenceReferences,
    settlementReferences,
    regulatoryReferences,
    sharingReferences,
    auditReferences,
    operationalReferences,
    trustRestrictions,
    redactions: REDACTIONS,
    blockedReasons,
    canonicalEvents,
  };
}
