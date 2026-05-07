import type {
  InteroperabilityAdapterReference,
  InteroperabilityAdapterReferenceStatus,
  InteroperabilityAdapterReferenceType,
  InteroperabilityAdapterRestriction,
} from "./interoperabilityAdapterTypes";

function asString(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

export function interoperabilityAdapterIdPart(value: unknown): string {
  return asString(value, 500)
    .toLowerCase()
    .replace(/[\/\\#?]+/g, "_")
    .replace(/[^a-z0-9_.:-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function adapterReference(input: {
  idParts: unknown[];
  referenceType: InteroperabilityAdapterReferenceType;
  status: InteroperabilityAdapterReferenceStatus;
  label: string;
  description: string;
  lineageReferences?: string[];
  destination?: string | null;
  redacted?: boolean;
  redactionReason?: string | null;
  blockedReason?: string | null;
}): InteroperabilityAdapterReference {
  return {
    referenceId: interoperabilityAdapterIdPart(input.idParts.join(":")) || "interoperability_adapter_reference:unknown",
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

export function adapterRestriction(input: {
  idParts: unknown[];
  restrictionType: InteroperabilityAdapterRestriction["restrictionType"];
  status: InteroperabilityAdapterRestriction["status"];
  label: string;
  description: string;
  blockedReason?: string | null;
}): InteroperabilityAdapterRestriction {
  return {
    restrictionId: interoperabilityAdapterIdPart(input.idParts.join(":")) || "interoperability_adapter_restriction:unknown",
    restrictionType: input.restrictionType,
    status: input.status,
    label: input.label,
    description: input.description,
    blockedReason: input.blockedReason || null,
  };
}
