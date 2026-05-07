import type {
  CrossOrganizationTrustReference,
  CrossOrganizationTrustReferenceStatus,
  CrossOrganizationTrustReferenceType,
  CrossOrganizationTrustRestriction,
} from "./crossOrganizationTrustTypes";

function asString(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

export function crossOrganizationTrustIdPart(value: unknown): string {
  return asString(value, 500)
    .toLowerCase()
    .replace(/[\/\\#?]+/g, "_")
    .replace(/[^a-z0-9_.:-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function trustReference(input: {
  idParts: unknown[];
  referenceType: CrossOrganizationTrustReferenceType;
  status: CrossOrganizationTrustReferenceStatus;
  label: string;
  description: string;
  lineageReferences?: string[];
  destination?: string | null;
  redacted?: boolean;
  redactionReason?: string | null;
  blockedReason?: string | null;
}): CrossOrganizationTrustReference {
  return {
    trustReferenceId: crossOrganizationTrustIdPart(input.idParts.join(":")) || "trust_reference:unknown",
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

export function trustRestriction(input: {
  idParts: unknown[];
  restrictionType: CrossOrganizationTrustRestriction["restrictionType"];
  status: CrossOrganizationTrustRestriction["status"];
  label: string;
  description: string;
  blockedReason?: string | null;
}): CrossOrganizationTrustRestriction {
  return {
    restrictionId: crossOrganizationTrustIdPart(input.idParts.join(":")) || "trust_restriction:unknown",
    restrictionType: input.restrictionType,
    status: input.status,
    label: input.label,
    description: input.description,
    blockedReason: input.blockedReason || null,
  };
}
