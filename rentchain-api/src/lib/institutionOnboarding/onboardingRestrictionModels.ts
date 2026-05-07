import type {
  InstitutionOnboardingReference,
  InstitutionOnboardingReferenceStatus,
  InstitutionOnboardingReferenceType,
  InstitutionOnboardingRestriction,
} from "./institutionOnboardingTypes";

function asString(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

export function institutionOnboardingIdPart(value: unknown): string {
  return asString(value, 500)
    .toLowerCase()
    .replace(/[\/\\#?]+/g, "_")
    .replace(/[^a-z0-9_.:-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function onboardingReference(input: {
  idParts: unknown[];
  referenceType: InstitutionOnboardingReferenceType;
  status: InstitutionOnboardingReferenceStatus;
  label: string;
  description: string;
  lineageReferences?: string[];
  destination?: string | null;
  redacted?: boolean;
  redactionReason?: string | null;
  blockedReason?: string | null;
}): InstitutionOnboardingReference {
  return {
    referenceId: institutionOnboardingIdPart(input.idParts.join(":")) || "institution_onboarding_reference:unknown",
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

export function onboardingRestriction(input: {
  idParts: unknown[];
  restrictionType: InstitutionOnboardingRestriction["restrictionType"];
  status: InstitutionOnboardingRestriction["status"];
  label: string;
  description: string;
  blockedReason?: string | null;
}): InstitutionOnboardingRestriction {
  return {
    restrictionId: institutionOnboardingIdPart(input.idParts.join(":")) || "institution_onboarding_restriction:unknown",
    restrictionType: input.restrictionType,
    status: input.status,
    label: input.label,
    description: input.description,
    blockedReason: input.blockedReason || null,
  };
}
