import type {
  DebtReference,
  DebtReferenceStatus,
  DebtReferenceType,
  DebtRestriction,
} from "./rentalDebtTypes";

export function debtIdPart(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\/\\#?]+/g, "_")
    .replace(/[^a-z0-9_.:-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 240);
}

export function debtReference(input: {
  idParts: unknown[];
  referenceType: DebtReferenceType;
  status: DebtReferenceStatus;
  label: string;
  description: string;
  lineageReferences?: string[];
  destination?: string | null;
  redacted?: boolean;
  redactionReason?: string | null;
  blockedReason?: string | null;
}): DebtReference {
  const referenceId = debtIdPart(input.idParts.filter(Boolean).join(":")) || `${input.referenceType}:unknown`;
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

export function debtRestriction(input: {
  idParts: unknown[];
  restrictionType: DebtRestriction["restrictionType"];
  status: DebtRestriction["status"];
  label: string;
  description: string;
  blockedReason?: string | null;
}): DebtRestriction {
  const restrictionId = debtIdPart(["debt_restriction", ...input.idParts].filter(Boolean).join(":"));
  return {
    restrictionId: restrictionId || "debt_restriction:unknown",
    restrictionType: input.restrictionType,
    status: input.status,
    label: input.label,
    description: input.description,
    blockedReason: input.blockedReason || null,
  };
}
