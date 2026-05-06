import type {
  DeriveNetworkParticipantProfileInput,
  NetworkParticipantCanonicalEvent,
  NetworkParticipantProfile,
  NetworkParticipantStatus,
  NetworkParticipantType,
  NetworkRelationshipReference,
} from "./networkParticipantTypes";
import { networkParticipantIdPart, participantReference, relationshipReference } from "./networkRelationshipModels";

const PARTICIPANT_TYPES = new Set<NetworkParticipantType>([
  "landlord",
  "operator",
  "lender",
  "insurer",
  "auditor",
  "regulator",
  "contractor",
  "institutional_partner",
  "review_actor",
]);

const REDACTIONS = [
  "Private identity details and raw government identifiers are excluded.",
  "Raw screening and credit bureau payloads are excluded.",
  "Payment account details and unrestricted financial information are excluded.",
  "Unrestricted audit histories and private tenant communications are excluded.",
  "Network participants are permissioned operational actors, not public profiles.",
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

function normalizeType(value: unknown): NetworkParticipantType {
  const raw = asString(value, 80) as NetworkParticipantType;
  return PARTICIPANT_TYPES.has(raw) ? raw : "landlord";
}

function event(input: {
  eventType: NetworkParticipantCanonicalEvent["eventType"];
  status: NetworkParticipantStatus;
  participantId: string;
  summary: string;
}): NetworkParticipantCanonicalEvent {
  return {
    eventType: input.eventType,
    action: input.eventType.replace(/^network_/, "").replace(/_/g, "."),
    status: input.status,
    resourceType: "network_participant",
    resourceId: input.participantId,
    summary: input.summary,
  };
}

function statusFromRelationships(hasContext: boolean, relationships: NetworkRelationshipReference[]): NetworkParticipantStatus {
  if (!hasContext) return "unknown";
  if (relationships.some((relationship) => relationship.status === "blocked")) return "blocked";
  if (relationships.some((relationship) => relationship.status === "unavailable")) return "review_required";
  if (relationships.some((relationship) => relationship.status === "partially_verified")) return "partially_verified";
  return "verified";
}

function participantMatches(record: Record<string, any>, participantType: NetworkParticipantType, participantId: string) {
  if (!participantId) return true;
  const values = [
    record.id,
    record.participantId,
    record.identityId,
    record.userId,
    record.actorId,
    record.openedById,
    record.reviewActorId,
    record.contractorId,
    record.institutionId,
    record.sharingRoomId,
    record.type,
    record.participantType,
  ].map((value) => asString(value, 500));
  if (values.includes(participantId)) return true;
  if (participantType === "lender" || participantType === "insurer" || participantType === "auditor" || participantType === "regulator") {
    return asString(record.accessControls?.institutionType || record.institutionType, 80) === participantType;
  }
  return false;
}

export function deriveNetworkParticipantProfile(input: DeriveNetworkParticipantProfileInput): NetworkParticipantProfile {
  const landlordId = asString(input.landlordId, 240);
  const participantType = normalizeType(input.participantType);
  const requestedId = asString(input.participantId, 500);
  const participantId =
    networkParticipantIdPart(["network_participant", landlordId || "unknown", participantType, requestedId || "portfolio"].join(":")) ||
    "network_participant:unknown";

  const identityProfiles = asArray(input.identityProfiles);
  const sharingRooms = asArray(input.sharingRooms).filter((room) => participantMatches(room, participantType, requestedId));
  const reviews = asArray(input.operatorReviewSessions).filter((review) => participantMatches(review, participantType, requestedId));
  const evidencePacks = asArray(input.evidencePacks);
  const regulatoryProfiles = asArray(input.regulatoryProfiles);
  const events = asArray(input.canonicalEvents);
  const contractors = asArray(input.contractorProfiles).filter((contractor) => participantMatches(contractor, participantType, requestedId));
  const settlementReadiness = input.settlementReadiness || null;

  const identityReferences = identityProfiles.length
    ? identityProfiles.map((profile) =>
        participantReference({
          idParts: ["identity", profile.identityId || profile.id || participantType],
          referenceType: "identity",
          label: "Identity lineage reference",
          status: profile.status === "blocked" ? "blocked" : "available",
          destination: `/identity-layer?identityType=${encodeURIComponent(asString(profile.identityType || "organization", 80))}&identityId=${encodeURIComponent(
            asString(profile.identityId || profile.id, 500)
          )}`,
          blockedReason: profile.status === "blocked" ? "Identity lineage is blocked." : null,
        })
      )
    : [
        participantReference({
          idParts: ["identity", "missing", participantType],
          referenceType: "identity",
          label: "Identity lineage reference",
          status: participantType === "landlord" ? "available" : "missing",
          blockedReason: participantType === "landlord" ? null : "Identity lineage is missing for this participant type.",
        }),
      ];

  const reviewReferences = reviews.map((review) =>
    participantReference({
      idParts: ["review", review.reviewSessionId || review.id || "unknown"],
      referenceType: "review",
      label: "Operator review lineage",
      status: review.status === "completed" ? "available" : "missing",
      destination: "/review-timeline",
      occurredAt: review.closedAt || review.openedAt || review.createdAt,
      blockedReason: review.status === "blocked" ? "Operator review is blocked." : null,
    })
  );

  const evidenceReferences = evidencePacks.map((pack) =>
    participantReference({
      idParts: ["evidence", pack.evidencePackId || pack.id || "unknown"],
      referenceType: "evidence",
      label: "Evidence lineage",
      status: pack.status === "blocked" ? "blocked" : "available",
      destination: "/evidence-packs",
      occurredAt: pack.generatedAt || pack.createdAt,
      blockedReason: pack.status === "blocked" ? "Evidence pack is blocked." : null,
    })
  );

  const permissionReferences = sharingRooms.map((room) =>
    participantReference({
      idParts: ["permission", room.sharingRoomId || room.id || "unknown"],
      referenceType: "permission",
      label: "Permissioned sharing boundary",
      status: room.publiclyAccessible || room.externalExecutionEnabled ? "blocked" : "available",
      destination: "/institutional-sharing-rooms",
      occurredAt: room.updatedAt || room.createdAt,
      blockedReason: room.publiclyAccessible || room.externalExecutionEnabled ? "Sharing room indicates public access or external execution." : null,
    })
  );

  const relationshipReferences: NetworkRelationshipReference[] = [];
  relationshipReferences.push(
    relationshipReference({
      idParts: ["verification", participantId],
      relationshipType: "verification_relationship",
      status: identityReferences.some((reference) => reference.status === "blocked")
        ? "blocked"
        : identityReferences.some((reference) => reference.status === "missing")
          ? "unavailable"
          : "verified",
      label: "Identity verification relationship",
      description: "Identity lineage is available as permission-scoped participant metadata.",
      participantReferences: identityReferences.map((reference) => reference.referenceId),
      reviewLineage: reviewReferences.map((reference) => reference.referenceId),
      destination: "/identity-layer",
      blockedReason: identityReferences.some((reference) => reference.status === "blocked") ? "Identity relationship requires manual review." : null,
    })
  );

  if (sharingRooms.length) {
    for (const room of sharingRooms) {
      relationshipReferences.push(
        relationshipReference({
          idParts: ["sharing", room.sharingRoomId || room.id || "unknown"],
          relationshipType: "sharing_relationship",
          status: room.publiclyAccessible || room.externalExecutionEnabled || room.status === "blocked" ? "blocked" : room.status === "active" ? "verified" : "partially_verified",
          label: "Institutional sharing relationship",
          description: "Sharing-room metadata is available as a controlled relationship reference.",
          participantReferences: [asString(room.sharingRoomId || room.id, 240)].filter(Boolean),
          permissionReferences: permissionReferences.map((reference) => reference.referenceId),
          evidenceLineage: evidenceReferences.map((reference) => reference.referenceId),
          reviewLineage: reviewReferences.map((reference) => reference.referenceId),
          destination: "/institutional-sharing-rooms",
          blockedReason: room.publiclyAccessible || room.externalExecutionEnabled ? "Public access or external execution is not allowed for network participants." : null,
        })
      );
    }
  } else {
    relationshipReferences.push(
      relationshipReference({
        idParts: ["sharing", "missing", participantType],
        relationshipType: "sharing_relationship",
        status: participantType === "landlord" || participantType === "operator" || participantType === "review_actor" ? "partially_verified" : "unavailable",
        label: "Institutional sharing relationship",
        description: "No institutional sharing relationship is currently available for this participant.",
        blockedReason: null,
      })
    );
  }

  if (reviews.length) {
    relationshipReferences.push(
      relationshipReference({
        idParts: ["review", participantId],
        relationshipType: "review_relationship",
        status: reviews.some((review) => review.status === "completed") ? "verified" : "partially_verified",
        label: "Review relationship",
        description: "Operator review lineage is available for this participant.",
        reviewLineage: reviewReferences.map((reference) => reference.referenceId),
        destination: "/review-timeline",
      })
    );
  }

  if (evidencePacks.length) {
    relationshipReferences.push(
      relationshipReference({
        idParts: ["evidence", participantId],
        relationshipType: "evidence_relationship",
        status: evidencePacks.some((pack) => pack.status === "blocked") ? "blocked" : "verified",
        label: "Evidence relationship",
        description: "Evidence pack lineage is available for participant review.",
        evidenceLineage: evidenceReferences.map((reference) => reference.referenceId),
        destination: "/evidence-packs",
        blockedReason: evidencePacks.some((pack) => pack.status === "blocked") ? "Evidence relationship is blocked." : null,
      })
    );
  }

  if (settlementReadiness || regulatoryProfiles.length || contractors.length) {
    relationshipReferences.push(
      relationshipReference({
        idParts: ["operational", participantId],
        relationshipType: "operational_relationship",
        status:
          settlementReadiness?.status === "blocked" || regulatoryProfiles.some((profile) => profile.status === "blocked")
            ? "blocked"
            : "partially_verified",
        label: "Operational relationship",
        description: "Settlement, regulatory, or contractor metadata is available as operational ecosystem context.",
        participantReferences: contractors.map((contractor) => asString(contractor.contractorId || contractor.id, 240)).filter(Boolean),
        evidenceLineage: evidenceReferences.map((reference) => reference.referenceId),
        reviewLineage: reviewReferences.map((reference) => reference.referenceId),
        destination: settlementReadiness ? "/settlement-readiness" : regulatoryProfiles.length ? "/regulatory-profiles" : null,
        blockedReason:
          settlementReadiness?.status === "blocked" || regulatoryProfiles.some((profile) => profile.status === "blocked")
            ? "Settlement or regulatory relationship is blocked."
            : null,
      })
    );
  }

  const hasContext = Boolean(
    landlordId &&
      (participantType === "landlord" ||
        identityProfiles.length ||
        requestedId ||
        sharingRooms.length ||
        reviews.length ||
        contractors.length ||
        events.length ||
        settlementReadiness ||
        regulatoryProfiles.length)
  );
  const status = statusFromRelationships(hasContext, relationshipReferences);
  const blockedReasons = relationshipReferences.map((relationship) => relationship.blockedReason).filter(Boolean) as string[];
  const canonicalEvents: NetworkParticipantCanonicalEvent[] = [
    event({
      eventType: "network_participant_profile_derived",
      status,
      participantId,
      summary: "Network participant profile derived from permission-scoped operational references.",
    }),
    event({
      eventType: "network_relationship_redaction_applied",
      status,
      participantId,
      summary: "Private identity, screening, payment, audit, and contact payloads were excluded from participant references.",
    }),
  ];
  if (relationshipReferences.some((relationship) => relationship.status === "verified")) {
    canonicalEvents.push(
      event({
        eventType: "network_relationship_verified",
        status,
        participantId,
        summary: "At least one permission-scoped network relationship is verified.",
      })
    );
  }
  if (status === "review_required" || status === "partially_verified") {
    canonicalEvents.push(
      event({
        eventType: "network_relationship_review_required",
        status,
        participantId,
        summary: "Manual relationship review is required before relying on this participant profile.",
      })
    );
  }
  if (status === "blocked") {
    canonicalEvents.push(
      event({
        eventType: "network_relationship_blocked",
        status,
        participantId,
        summary: "Network relationship is blocked by unsafe or conflicting references.",
      })
    );
  }

  return {
    participantId,
    participantType,
    status,
    manualReviewRequired: true,
    publiclyDiscoverable: false,
    externalRelationshipExecutionEnabled: false,
    generatedAt: generatedAt(input.generatedAt),
    summary: {
      totalRelationships: relationshipReferences.length,
      verifiedRelationships: relationshipReferences.filter((relationship) => relationship.status === "verified").length,
      partiallyVerifiedRelationships: relationshipReferences.filter((relationship) => relationship.status === "partially_verified").length,
      blockedRelationships: relationshipReferences.filter((relationship) => relationship.status === "blocked").length,
      unavailableRelationships: relationshipReferences.filter((relationship) => relationship.status === "unavailable").length,
      evidenceReferences: evidenceReferences.length,
      reviewReferences: reviewReferences.length,
      permissionReferences: permissionReferences.length,
    },
    identityReferences,
    relationshipReferences,
    reviewReferences,
    evidenceReferences,
    permissionReferences,
    redactions: REDACTIONS,
    blockedReasons,
    canonicalEvents,
  };
}
