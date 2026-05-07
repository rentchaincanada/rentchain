import type { ReleaseReference, ReleaseReferenceStatus, ReleaseReferenceType, ReleaseRestriction } from "./releaseGovernanceTypes";

function asString(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

export function releaseGovernanceIdPart(value: unknown): string {
  return asString(value, 500)
    .toLowerCase()
    .replace(/[\/\\#?]+/g, "_")
    .replace(/[^a-z0-9_.:-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function releaseReference(input: {
  idParts: unknown[];
  referenceType: ReleaseReferenceType;
  status: ReleaseReferenceStatus;
  label: string;
  description: string;
  lineageReferences?: string[];
  destination?: string | null;
  redacted?: boolean;
  redactionReason?: string | null;
  blockedReason?: string | null;
}): ReleaseReference {
  return {
    referenceId: releaseGovernanceIdPart(input.idParts.join(":")) || "release_governance_reference:unknown",
    referenceType: input.referenceType,
    status: input.status,
    label: input.label,
    description: input.description,
    reviewRequired: true,
    lineageReferences: Array.from(new Set(input.lineageReferences || [])).filter(Boolean),
    destination: input.destination || null,
    redacted: Boolean(input.redacted),
    redactionReason: input.redactionReason || null,
    blockedReason: input.blockedReason || null,
  };
}

export function releaseRestriction(input: {
  idParts: unknown[];
  restrictionType: ReleaseRestriction["restrictionType"];
  status: ReleaseRestriction["status"];
  label: string;
  description: string;
  blockedReason?: string | null;
}): ReleaseRestriction {
  return {
    restrictionId: releaseGovernanceIdPart(input.idParts.join(":")) || "release_governance_restriction:unknown",
    restrictionType: input.restrictionType,
    status: input.status,
    label: input.label,
    description: input.description,
    blockedReason: input.blockedReason || null,
  };
}
