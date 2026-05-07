import type {
  EcosystemCoordinationReference,
  EcosystemCoordinationReferenceStatus,
  EcosystemCoordinationReferenceType,
  EcosystemRestriction,
} from "./ecosystemCoordinationTypes";

function asString(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

export function ecosystemIdPart(value: unknown): string {
  return asString(value, 500)
    .toLowerCase()
    .replace(/[\/\\#?]+/g, "_")
    .replace(/[^a-z0-9_.:-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function ecosystemReference(input: {
  idParts: unknown[];
  referenceType: EcosystemCoordinationReferenceType;
  status: EcosystemCoordinationReferenceStatus;
  label: string;
  description: string;
  lineageReferences?: string[];
  destination?: string | null;
  redacted?: boolean;
  redactionReason?: string | null;
  blockedReason?: string | null;
}): EcosystemCoordinationReference {
  return {
    referenceId: ecosystemIdPart(input.idParts.join(":")) || "ecosystem_reference:unknown",
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

export function ecosystemRestriction(input: {
  idParts: unknown[];
  restrictionType: EcosystemRestriction["restrictionType"];
  status: EcosystemRestriction["status"];
  label: string;
  description: string;
  blockedReason?: string | null;
}): EcosystemRestriction {
  return {
    restrictionId: ecosystemIdPart(input.idParts.join(":")) || "ecosystem_restriction:unknown",
    restrictionType: input.restrictionType,
    status: input.status,
    label: input.label,
    description: input.description,
    blockedReason: input.blockedReason || null,
  };
}
