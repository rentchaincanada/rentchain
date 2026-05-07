import type {
  OnboardingReference,
  OnboardingReferenceStatus,
  OnboardingReferenceType,
  OnboardingRestriction,
} from "./onboardingHardeningTypes";

export function onboardingHardeningIdPart(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\/\\#?]+/g, "_")
    .replace(/[^a-z0-9_.:-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 240);
}

export function onboardingReference(input: {
  idParts: unknown[];
  referenceType: OnboardingReferenceType;
  status: OnboardingReferenceStatus;
  label: string;
  description: string;
  lineageReferences?: string[];
  destination?: string | null;
  redacted?: boolean;
  redactionReason?: string | null;
  blockedReason?: string | null;
}): OnboardingReference {
  const referenceId = onboardingHardeningIdPart(input.idParts.filter(Boolean).join(":")) || `${input.referenceType}:unknown`;
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

export function onboardingRestriction(input: {
  idParts: unknown[];
  restrictionType: OnboardingRestriction["restrictionType"];
  status: OnboardingRestriction["status"];
  label: string;
  description: string;
  blockedReason?: string | null;
}): OnboardingRestriction {
  const restrictionId = onboardingHardeningIdPart(["onboarding_restriction", ...input.idParts].filter(Boolean).join(":"));
  return {
    restrictionId: restrictionId || "onboarding_restriction:unknown",
    restrictionType: input.restrictionType,
    status: input.status,
    label: input.label,
    description: input.description,
    blockedReason: input.blockedReason || null,
  };
}
