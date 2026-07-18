import { assembleLandlordLeaseReceivablesDto } from "./leaseReceivablesDtoAssembler";
import { normalizeLegacyReceivablesSources } from "./legacyReceivablesSourceNormalizer";
import {
  RECEIVABLES_SHADOW_COMPARISON_VERSION,
  RECEIVABLES_SHADOW_SOURCE_KEYS,
  type CompareReceivablesShadowInput,
  type ReceivablesShadowComparatorResult,
  type ReceivablesShadowReasonCode,
  type ReceivablesShadowSourceKey,
} from "./receivablesShadowComparatorTypes";
import { cleanAccountingString } from "./receivablesTypes";

const IDENTITY_SOURCE_KEYS = new Set<ReceivablesShadowSourceKey>(["lease", "property", "tenantResponsibility"]);

function disabled(reasonCode: ReceivablesShadowReasonCode): ReceivablesShadowComparatorResult {
  return {
    ok: false,
    enabled: false,
    allowed: false,
    status: "disabled",
    reasonCode,
    warnings: [],
    comparisonVersion: RECEIVABLES_SHADOW_COMPARISON_VERSION,
  };
}

function result(
  enabled: boolean,
  allowed: boolean,
  status: ReceivablesShadowComparatorResult["status"],
  reasonCode: ReceivablesShadowReasonCode
): ReceivablesShadowComparatorResult {
  return {
    ok: status === "equivalent",
    enabled,
    allowed,
    status,
    reasonCode,
    warnings: [],
    comparisonVersion: RECEIVABLES_SHADOW_COMPARISON_VERSION,
  };
}

function isExplicitlyEnabled(value: unknown): boolean {
  return value === true || value === "true";
}

function parseExactAllowlist(value: unknown): string[] | null {
  const candidates = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  const normalized = candidates.map((entry) => cleanAccountingString(entry)).filter((entry): entry is string => Boolean(entry));
  if (normalized.length === 0 || normalized.some((entry) => entry === "*")) return null;
  return [...new Set(normalized)].sort();
}

function sourcesAreComplete(input: CompareReceivablesShadowInput): boolean {
  return RECEIVABLES_SHADOW_SOURCE_KEYS.every((key) => {
    const state = input.sourceCompleteness?.[key];
    return IDENTITY_SOURCE_KEYS.has(key) ? state === "complete" : state === "complete" || state === "empty_confirmed";
  });
}

function ownershipIsExact(input: CompareReceivablesShadowInput, requestLandlordId: string): boolean {
  const leaseId = cleanAccountingString(input.normalizationInput?.leaseId);
  const propertyId = cleanAccountingString(input.normalizationInput?.propertyId);
  const normalizationLandlordId = cleanAccountingString(input.normalizationInput?.landlordId);
  const proofLandlordId = cleanAccountingString(input.ownershipProof?.landlordId);
  const proofLeaseId = cleanAccountingString(input.ownershipProof?.leaseId);
  const dtoLeaseId = cleanAccountingString(input.dtoInput?.leaseId);
  const dtoPropertyId = cleanAccountingString(input.dtoInput?.propertyId);
  return Boolean(
    input.ownershipProof?.state === "independently_verified" &&
      leaseId &&
      propertyId &&
      requestLandlordId === normalizationLandlordId &&
      requestLandlordId === proofLandlordId &&
      leaseId === proofLeaseId &&
      leaseId === dtoLeaseId &&
      propertyId === dtoPropertyId &&
      input.normalizationInput.ownershipProof?.state === "independently_verified" &&
      cleanAccountingString(input.normalizationInput.ownershipProof.landlordId) === requestLandlordId &&
      cleanAccountingString(input.normalizationInput.ownershipProof.leaseId) === leaseId
  );
}

export function compareReceivablesShadow(input: CompareReceivablesShadowInput): ReceivablesShadowComparatorResult {
  if (!isExplicitlyEnabled(input.config?.enabled)) return disabled("SHADOW_DISABLED");

  const allowlist = parseExactAllowlist(input.config?.landlordAllowlist);
  const requestLandlordId = cleanAccountingString(input.requestLandlordId);
  if (!allowlist || !requestLandlordId || !allowlist.includes(requestLandlordId)) {
    return result(true, false, "not_allowed", "SHADOW_NOT_ALLOWLISTED");
  }

  if (!ownershipIsExact(input, requestLandlordId)) {
    return result(true, true, "not_ready", "SHADOW_OWNERSHIP_UNVERIFIED");
  }
  if (!sourcesAreComplete(input)) {
    return result(true, true, "not_ready", "SHADOW_SOURCE_INCOMPLETE");
  }

  const normalization = normalizeLegacyReceivablesSources(input.normalizationInput);
  if (normalization.sourceState !== "complete" || normalization.findings.some((finding) => finding.severity === "error")) {
    return result(true, true, "not_ready", "SHADOW_NORMALIZATION_FAILED");
  }

  if (input.legacyProjection?.state !== "available" || !Number.isSafeInteger(input.legacyProjection.balanceCents)) {
    return result(true, true, "not_ready", "SHADOW_LEGACY_PARITY_UNAVAILABLE");
  }

  try {
    const dto = assembleLandlordLeaseReceivablesDto({
      ...input.dtoInput,
      transactions: normalization.transactions,
      transactionSourceState: normalization.sourceState,
      legacyBalanceCents: input.legacyProjection.balanceCents,
    });
    if (dto.sourceEquivalence.status === "mismatch") {
      return result(true, true, "not_ready", "SHADOW_PARITY_MISMATCH");
    }
    if (
      dto.sourceEquivalence.status !== "equivalent" ||
      dto.dataCompleteness.status !== "complete" ||
      !dto.balanceSummary ||
      !dto.agingSummary ||
      !dto.rentRollSummary ||
      dto.schedulePreviewSummary.status !== "available" ||
      dto.schedulePreviewSummary.stale
    ) {
      return result(true, true, "not_ready", "SHADOW_DTO_ASSEMBLY_FAILED");
    }
  } catch {
    return result(true, true, "not_ready", "SHADOW_DTO_ASSEMBLY_FAILED");
  }

  return result(true, true, "equivalent", "SHADOW_EQUIVALENT");
}
