import type {
  ProductionIntegrationReference,
  ProductionIntegrationReferenceStatus,
  ProductionIntegrationReferenceType,
  ProductionIntegrationRestriction,
} from "./productionIntegrationTypes";

function asString(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

export function productionIntegrationIdPart(value: unknown): string {
  return asString(value, 500)
    .toLowerCase()
    .replace(/[\/\\#?]+/g, "_")
    .replace(/[^a-z0-9_.:-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function productionIntegrationReference(input: {
  idParts: unknown[];
  referenceType: ProductionIntegrationReferenceType;
  status: ProductionIntegrationReferenceStatus;
  label: string;
  description: string;
  lineageReferences?: string[];
  destination?: string | null;
  redacted?: boolean;
  redactionReason?: string | null;
  blockedReason?: string | null;
}): ProductionIntegrationReference {
  return {
    referenceId: productionIntegrationIdPart(input.idParts.filter(Boolean).join(":")) || "production_integration_reference:unknown",
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

export function productionIntegrationRestriction(input: {
  idParts: unknown[];
  restrictionType: ProductionIntegrationRestriction["restrictionType"];
  status: ProductionIntegrationRestriction["status"];
  label: string;
  description: string;
  blockedReason?: string | null;
}): ProductionIntegrationRestriction {
  return {
    restrictionId:
      productionIntegrationIdPart(["production_integration_restriction", ...input.idParts].filter(Boolean).join(":")) ||
      "production_integration_restriction:unknown",
    restrictionType: input.restrictionType,
    status: input.status,
    label: input.label,
    description: input.description,
    blockedReason: input.blockedReason || null,
  };
}
