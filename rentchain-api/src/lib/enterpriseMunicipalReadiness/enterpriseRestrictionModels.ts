import type {
  EnterpriseMunicipalReference,
  EnterpriseMunicipalReferenceStatus,
  EnterpriseMunicipalReferenceType,
  EnterpriseMunicipalRestriction,
} from "./enterpriseMunicipalReadinessTypes";

function asString(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

export function enterpriseMunicipalIdPart(value: unknown): string {
  return asString(value, 500)
    .toLowerCase()
    .replace(/[\/\\#?]+/g, "_")
    .replace(/[^a-z0-9_.:-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function enterpriseMunicipalReference(input: {
  idParts: unknown[];
  referenceType: EnterpriseMunicipalReferenceType;
  status: EnterpriseMunicipalReferenceStatus;
  label: string;
  description: string;
  lineageReferences?: string[];
  destination?: string | null;
  redacted?: boolean;
  redactionReason?: string | null;
  blockedReason?: string | null;
}): EnterpriseMunicipalReference {
  return {
    referenceId: enterpriseMunicipalIdPart(input.idParts.filter(Boolean).join(":")) || "enterprise_municipal_reference:unknown",
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

export function enterpriseMunicipalRestriction(input: {
  idParts: unknown[];
  restrictionType: EnterpriseMunicipalRestriction["restrictionType"];
  status: EnterpriseMunicipalRestriction["status"];
  label: string;
  description: string;
  blockedReason?: string | null;
}): EnterpriseMunicipalRestriction {
  return {
    restrictionId:
      enterpriseMunicipalIdPart(["enterprise_municipal_restriction", ...input.idParts].filter(Boolean).join(":")) ||
      "enterprise_municipal_restriction:unknown",
    restrictionType: input.restrictionType,
    status: input.status,
    label: input.label,
    description: input.description,
    blockedReason: input.blockedReason || null,
  };
}
