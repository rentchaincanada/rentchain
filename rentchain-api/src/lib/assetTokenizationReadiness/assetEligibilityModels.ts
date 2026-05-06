import type {
  AssetTokenizationReference,
  AssetTokenizationReferenceStatus,
  AssetTokenizationReferenceType,
} from "./assetTokenizationReadinessTypes";

export function assetTokenizationIdPart(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\/\\#?]+/g, "_")
    .replace(/[^a-z0-9_.:-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function assetReference(input: {
  idParts: unknown[];
  referenceType: AssetTokenizationReferenceType;
  status: AssetTokenizationReferenceStatus;
  label: string;
  description: string;
  sourceId?: unknown;
  destination?: string | null;
  redacted?: boolean;
  redactionReason?: string | null;
  blockedReason?: string | null;
}): AssetTokenizationReference {
  return {
    assetReferenceId: assetTokenizationIdPart(["asset_tokenization", ...input.idParts].join(":")) || "asset_tokenization:unknown",
    referenceType: input.referenceType,
    status: input.status,
    label: input.label,
    description: input.description,
    reviewRequired: true,
    tokenizationEligible: false,
    sourceId: String(input.sourceId ?? "").trim() || null,
    destination: input.destination || null,
    redacted: Boolean(input.redacted),
    redactionReason: input.redactionReason || null,
    blockedReason: input.blockedReason || null,
  };
}
