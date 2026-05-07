import type {
  CourtDisputeReference,
  CourtDisputeReferenceStatus,
  CourtDisputeReferenceType,
  CourtDisputeRestriction,
} from "./courtDisputeLineageTypes";

export function courtDisputeIdPart(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\/\\#?]+/g, "_")
    .replace(/[^a-z0-9_.:-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 240);
}

export function courtDisputeReference(input: {
  idParts: unknown[];
  referenceType: CourtDisputeReferenceType;
  status: CourtDisputeReferenceStatus;
  label: string;
  description: string;
  lineageReferences?: string[];
  destination?: string | null;
  redacted?: boolean;
  redactionReason?: string | null;
  blockedReason?: string | null;
}): CourtDisputeReference {
  const referenceId = courtDisputeIdPart(input.idParts.filter(Boolean).join(":")) || `${input.referenceType}:unknown`;
  return {
    referenceId,
    referenceType: input.referenceType,
    status: input.status,
    label: input.label,
    description: input.description,
    reviewRequired: true,
    lineageReferences: Array.from(new Set(input.lineageReferences || [])).filter(Boolean).slice(0, 20),
    destination: input.destination || null,
    redacted: Boolean(input.redacted),
    redactionReason: input.redactionReason || null,
    blockedReason: input.blockedReason || null,
  };
}

export function courtDisputeRestriction(input: {
  idParts: unknown[];
  restrictionType: CourtDisputeRestriction["restrictionType"];
  status: CourtDisputeRestriction["status"];
  label: string;
  description: string;
  blockedReason?: string | null;
}): CourtDisputeRestriction {
  const restrictionId = courtDisputeIdPart(["court_dispute_restriction", ...input.idParts].filter(Boolean).join(":"));
  return {
    restrictionId: restrictionId || "court_dispute_restriction:unknown",
    restrictionType: input.restrictionType,
    status: input.status,
    label: input.label,
    description: input.description,
    blockedReason: input.blockedReason || null,
  };
}
