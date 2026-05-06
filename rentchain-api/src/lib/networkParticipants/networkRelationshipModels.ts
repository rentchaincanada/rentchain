import type {
  NetworkParticipantReference,
  NetworkRelationshipReference,
  NetworkRelationshipStatus,
  NetworkRelationshipType,
} from "./networkParticipantTypes";

function asString(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

export function networkParticipantIdPart(value: unknown): string {
  return asString(value, 500)
    .toLowerCase()
    .replace(/[\/\\#?]+/g, "_")
    .replace(/[^a-z0-9_.:-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function participantReference(input: {
  idParts: unknown[];
  referenceType: NetworkParticipantReference["referenceType"];
  label: string;
  status?: NetworkParticipantReference["status"];
  destination?: string | null;
  occurredAt?: unknown;
  redacted?: boolean;
  blockedReason?: string | null;
}): NetworkParticipantReference {
  const redacted = Boolean(input.redacted);
  return {
    referenceId: networkParticipantIdPart(input.idParts.join(":")) || "network_reference:unknown",
    referenceType: input.referenceType,
    label: input.label,
    status: input.status || (redacted ? "redacted" : "available"),
    destination: input.destination || null,
    occurredAt: asString(input.occurredAt, 120) || null,
    redacted,
    blockedReason: input.blockedReason || null,
  };
}

export function relationshipReference(input: {
  idParts: unknown[];
  relationshipType: NetworkRelationshipType;
  status: NetworkRelationshipStatus;
  label: string;
  description: string;
  participantReferences?: string[];
  evidenceLineage?: string[];
  reviewLineage?: string[];
  permissionReferences?: string[];
  destination?: string | null;
  redacted?: boolean;
  redactionReason?: string | null;
  blockedReason?: string | null;
}): NetworkRelationshipReference {
  return {
    relationshipId: networkParticipantIdPart(input.idParts.join(":")) || "network_relationship:unknown",
    relationshipType: input.relationshipType,
    status: input.status,
    label: input.label,
    description: input.description,
    reviewRequired: true,
    participantReferences: Array.from(new Set(input.participantReferences || [])).filter(Boolean),
    evidenceLineage: Array.from(new Set(input.evidenceLineage || [])).filter(Boolean),
    reviewLineage: Array.from(new Set(input.reviewLineage || [])).filter(Boolean),
    permissionReferences: Array.from(new Set(input.permissionReferences || [])).filter(Boolean),
    destination: input.destination || null,
    redacted: Boolean(input.redacted),
    redactionReason: input.redactionReason || null,
    blockedReason: input.blockedReason || null,
  };
}
