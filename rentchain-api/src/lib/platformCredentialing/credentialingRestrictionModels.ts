import type {
  CredentialingReference,
  CredentialingReferenceStatus,
  CredentialingReferenceType,
  CredentialingRestriction,
} from "./platformCredentialingTypes";

export function credentialingIdPart(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\/\\#?]+/g, "_")
    .replace(/[^a-z0-9_.:-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 240);
}

export function credentialingReference(input: {
  idParts: unknown[];
  referenceType: CredentialingReferenceType;
  status: CredentialingReferenceStatus;
  label: string;
  description: string;
  lineageReferences?: string[];
  destination?: string | null;
  redacted?: boolean;
  redactionReason?: string | null;
  blockedReason?: string | null;
}): CredentialingReference {
  const referenceId = credentialingIdPart(input.idParts.filter(Boolean).join(":")) || `${input.referenceType}:unknown`;
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

export function credentialingRestriction(input: {
  idParts: unknown[];
  restrictionType: CredentialingRestriction["restrictionType"];
  status: CredentialingRestriction["status"];
  label: string;
  description: string;
  blockedReason?: string | null;
}): CredentialingRestriction {
  const restrictionId = credentialingIdPart(["credentialing_restriction", ...input.idParts].filter(Boolean).join(":"));
  return {
    restrictionId: restrictionId || "credentialing_restriction:unknown",
    restrictionType: input.restrictionType,
    status: input.status,
    label: input.label,
    description: input.description,
    blockedReason: input.blockedReason || null,
  };
}
