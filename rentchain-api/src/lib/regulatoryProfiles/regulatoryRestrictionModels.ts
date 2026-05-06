import type { RegulatoryJurisdiction, RegulatoryReference, RegulatoryReferenceStatus, RegulatoryReferenceType } from "./regulatoryProfileTypes";

function asString(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

export function regulatoryIdPart(value: unknown): string {
  return asString(value, 500)
    .toLowerCase()
    .replace(/[\/\\#?]+/g, "_")
    .replace(/[^a-z0-9_.:-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function regulatoryReference(input: {
  idParts: unknown[];
  referenceType: RegulatoryReferenceType;
  status: RegulatoryReferenceStatus;
  label: string;
  description: string;
  jurisdiction: RegulatoryJurisdiction;
  restricted?: boolean;
  reasons?: string[];
  reviewLineage?: string[];
  evidenceLineage?: string[];
  redacted?: boolean;
  redactionReason?: string | null;
  blockedReason?: string | null;
  destination?: string | null;
}): RegulatoryReference {
  return {
    referenceId: regulatoryIdPart(["regulatory", input.referenceType, ...input.idParts].filter(Boolean).join(":")) || "regulatory:unknown",
    referenceType: input.referenceType,
    status: input.status,
    label: input.label,
    description: input.description,
    jurisdictionScope: input.jurisdiction,
    restrictionSummary: {
      restricted: input.restricted === true,
      reasons: (input.reasons || []).filter(Boolean).slice(0, 8),
    },
    reviewLineage: (input.reviewLineage || []).filter(Boolean).slice(0, 8),
    evidenceLineage: (input.evidenceLineage || []).filter(Boolean).slice(0, 8),
    redacted: input.redacted === true,
    redactionReason: input.redactionReason || null,
    blockedReason: input.blockedReason || null,
    destination: input.destination || null,
  };
}
