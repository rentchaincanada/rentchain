import type {
  PublicExposureReference,
  PublicExposureReferenceStatus,
  PublicExposureReferenceType,
  PublicExposureRestriction,
} from "./publicExposureHardeningTypes";

function asString(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

export function publicExposureIdPart(value: unknown): string {
  return asString(value, 500)
    .toLowerCase()
    .replace(/[\/\\#?]+/g, "_")
    .replace(/[^a-z0-9_.:-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function publicExposureReference(input: {
  idParts: unknown[];
  referenceType: PublicExposureReferenceType;
  status: PublicExposureReferenceStatus;
  label: string;
  description: string;
  lineageReferences?: string[];
  destination?: string | null;
  redacted?: boolean;
  redactionReason?: string | null;
  blockedReason?: string | null;
}): PublicExposureReference {
  return {
    referenceId: publicExposureIdPart(input.idParts.join(":")) || "public_exposure_reference:unknown",
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

export function publicExposureRestriction(input: {
  idParts: unknown[];
  restrictionType: PublicExposureRestriction["restrictionType"];
  status: PublicExposureRestriction["status"];
  label: string;
  description: string;
  blockedReason?: string | null;
}): PublicExposureRestriction {
  return {
    restrictionId: publicExposureIdPart(input.idParts.join(":")) || "public_exposure_restriction:unknown",
    restrictionType: input.restrictionType,
    status: input.status,
    label: input.label,
    description: input.description,
    blockedReason: input.blockedReason || null,
  };
}
