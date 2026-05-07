import type {
  SupportOperationsReference,
  SupportOperationsRestriction,
  SupportReferenceStatus,
  SupportReferenceType,
} from "./supportOperationsTypes";

export function supportOperationsIdPart(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\/\\#?]+/g, "_")
    .replace(/[^a-z0-9_.:-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 240);
}

export function supportReference(input: {
  idParts: unknown[];
  referenceType: SupportReferenceType;
  status: SupportReferenceStatus;
  label: string;
  description: string;
  lineageReferences?: string[];
  destination?: string | null;
  redacted?: boolean;
  redactionReason?: string | null;
  blockedReason?: string | null;
}): SupportOperationsReference {
  const referenceId = supportOperationsIdPart(input.idParts.filter(Boolean).join(":")) || `${input.referenceType}:unknown`;
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

export function supportRestriction(input: {
  idParts: unknown[];
  restrictionType: SupportOperationsRestriction["restrictionType"];
  status: SupportOperationsRestriction["status"];
  label: string;
  description: string;
  blockedReason?: string | null;
}): SupportOperationsRestriction {
  const restrictionId = supportOperationsIdPart(["support_operations_restriction", ...input.idParts].filter(Boolean).join(":"));
  return {
    restrictionId: restrictionId || "support_operations_restriction:unknown",
    restrictionType: input.restrictionType,
    status: input.status,
    label: input.label,
    description: input.description,
    blockedReason: input.blockedReason || null,
  };
}
