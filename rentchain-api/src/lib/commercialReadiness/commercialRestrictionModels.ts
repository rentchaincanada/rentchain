import type {
  CommercialReference,
  CommercialReferenceStatus,
  CommercialReferenceType,
  CommercialRestriction,
} from "./commercialReadinessTypes";

function asString(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

export function commercialIdPart(value: unknown): string {
  return asString(value, 500)
    .toLowerCase()
    .replace(/[\/\\#?]+/g, "_")
    .replace(/[^a-z0-9_.:-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function commercialReference(input: {
  idParts: unknown[];
  referenceType: CommercialReferenceType;
  status: CommercialReferenceStatus;
  label: string;
  description: string;
  lineageReferences?: string[];
  destination?: string | null;
  redacted?: boolean;
  redactionReason?: string | null;
  blockedReason?: string | null;
}): CommercialReference {
  return {
    referenceId: commercialIdPart(input.idParts.join(":")) || "commercial_reference:unknown",
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

export function commercialRestriction(input: {
  idParts: unknown[];
  restrictionType: CommercialRestriction["restrictionType"];
  status: CommercialRestriction["status"];
  label: string;
  description: string;
  blockedReason?: string | null;
}): CommercialRestriction {
  return {
    restrictionId: commercialIdPart(input.idParts.join(":")) || "commercial_restriction:unknown",
    restrictionType: input.restrictionType,
    status: input.status,
    label: input.label,
    description: input.description,
    blockedReason: input.blockedReason || null,
  };
}
