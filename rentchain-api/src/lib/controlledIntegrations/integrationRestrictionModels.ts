import type {
  ControlledIntegrationReference,
  ControlledIntegrationReferenceStatus,
  ControlledIntegrationReferenceType,
  ControlledIntegrationRestriction,
} from "./controlledIntegrationTypes";

function asString(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

export function controlledIntegrationIdPart(value: unknown): string {
  return asString(value, 500)
    .toLowerCase()
    .replace(/[\/\\#?]+/g, "_")
    .replace(/[^a-z0-9_.:-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function controlledIntegrationReference(input: {
  idParts: unknown[];
  referenceType: ControlledIntegrationReferenceType;
  status: ControlledIntegrationReferenceStatus;
  label: string;
  description: string;
  lineageReferences?: string[];
  destination?: string | null;
  redacted?: boolean;
  redactionReason?: string | null;
  blockedReason?: string | null;
}): ControlledIntegrationReference {
  return {
    referenceId: controlledIntegrationIdPart(input.idParts.join(":")) || "controlled_integration_reference:unknown",
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

export function controlledIntegrationRestriction(input: {
  idParts: unknown[];
  restrictionType: ControlledIntegrationRestriction["restrictionType"];
  status: ControlledIntegrationRestriction["status"];
  label: string;
  description: string;
  blockedReason?: string | null;
}): ControlledIntegrationRestriction {
  return {
    restrictionId: controlledIntegrationIdPart(input.idParts.join(":")) || "controlled_integration_restriction:unknown",
    restrictionType: input.restrictionType,
    status: input.status,
    label: input.label,
    description: input.description,
    blockedReason: input.blockedReason || null,
  };
}
