import { normalizeLegacyReceivablesSources } from "./legacyReceivablesSourceNormalizer";
import type { LegacyReceivablesSourceKind, LegacyReceivablesSourceRecord } from "./legacyReceivablesSourceTypes";
import {
  RECEIVABLES_SOURCE_SNAPSHOT_VERSION,
  type IndependentLegacySignedEffect,
  type InternalReceivablesSourceSnapshotPackage,
  type ReceivablesSnapshotEvidenceBatches,
  type ReceivablesSourceCounts,
  type ReceivablesSourceSnapshotAdapterInput,
  type ReceivablesSourceSnapshotReasonCode,
} from "./receivablesSourceSnapshotTypes";
import type { ReceivablesShadowSourceCompleteness, ReceivablesShadowSourceState } from "./receivablesShadowComparatorTypes";
import { cleanAccountingString, parseDateOnly } from "./receivablesTypes";

const EXPECTED_BATCH_KIND: Record<keyof ReceivablesSnapshotEvidenceBatches, LegacyReceivablesSourceKind> = {
  ledgerEntries: "ledger_entry",
  paymentRecords: "payment_record",
  paymentIntents: "payment_intent",
  reconciliationRecords: "reconciliation_record",
  leaseObligations: "lease_obligation",
  allocationRecords: "allocation_record",
};

const UNSAFE_KEY_PATTERN = /(provider|processor|firestorepath|storagepath|internalscope|bankaccount|accountnumber|routingnumber|transitnumber|institutionnumber|iban|swift|credential|secret|token)/i;
const UNSAFE_VALUE_PATTERN = /^(?:gs:\/\/|firestore:\/\/)|\/(?:b|v1)\/documents\//i;

function containsUnsafeData(value: unknown, seen = new Set<object>()): boolean {
  if (typeof value === "string") return UNSAFE_VALUE_PATTERN.test(value.trim());
  if (!value || typeof value !== "object") return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.some((item) => containsUnsafeData(item, seen));
  return Object.entries(value as Record<string, unknown>).some(
    ([key, item]) => UNSAFE_KEY_PATTERN.test(key.replace(/[^a-z0-9]/gi, "")) || containsUnsafeData(item, seen)
  );
}

function parseExactAllowlist(value: unknown): string[] | null {
  const values = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  const normalized = values.map((item) => cleanAccountingString(item)).filter((item): item is string => Boolean(item));
  if (!normalized.length || normalized.some((item) => item === "*")) return null;
  return [...new Set(normalized)].sort();
}

function sourceCounts(input: ReceivablesSourceSnapshotAdapterInput): ReceivablesSourceCounts {
  return {
    ledgerEntries: input.evidence?.ledgerEntries?.records?.length || 0,
    paymentRecords: input.evidence?.paymentRecords?.records?.length || 0,
    paymentIntents: input.evidence?.paymentIntents?.records?.length || 0,
    reconciliationRecords: input.evidence?.reconciliationRecords?.records?.length || 0,
    leaseObligations: input.evidence?.leaseObligations?.records?.length || 0,
    allocationRecords: input.evidence?.allocationRecords?.records?.length || 0,
    legacyEffects: input.legacyEffects?.length || 0,
  };
}

function allEvidenceRecords(input: ReceivablesSourceSnapshotAdapterInput): LegacyReceivablesSourceRecord[] {
  return (Object.keys(EXPECTED_BATCH_KIND) as Array<keyof ReceivablesSnapshotEvidenceBatches>).flatMap(
    (key) => [...(input.evidence?.[key]?.records || [])]
  );
}

function statusForReasons(reasonCodes: readonly ReceivablesSourceSnapshotReasonCode[]) {
  if (reasonCodes.includes("SNAPSHOT_UNSAFE_SOURCE_DATA")) return "unsafe" as const;
  if (reasonCodes.some((code) => code.includes("AMBIGUOUS") || code === "SNAPSHOT_NORMALIZATION_FAILED")) return "ambiguous" as const;
  return "incomplete" as const;
}

function independentLegacyBalance(input: ReceivablesSourceSnapshotAdapterInput): number | null {
  const asOf = parseDateOnly(input.asOfDate);
  const landlordId = cleanAccountingString(input.lease.landlordId);
  const leaseId = cleanAccountingString(input.lease.leaseId);
  const propertyId = cleanAccountingString(input.lease.propertyId);
  if (!asOf || !landlordId || !leaseId || !propertyId) return null;
  const ids = new Set<string>();
  let balance = 0;
  for (const effect of input.legacyEffects || []) {
    const effectId = cleanAccountingString(effect.effectId);
    const effectiveDate = parseDateOnly(effect.effectiveDate);
    if (
      !effectId ||
      ids.has(effectId) ||
      cleanAccountingString(effect.landlordId) !== landlordId ||
      cleanAccountingString(effect.leaseId) !== leaseId ||
      cleanAccountingString(effect.propertyId) !== propertyId ||
      cleanAccountingString(effect.currency, 8)?.toLowerCase() !== "cad" ||
      !effectiveDate ||
      !Number.isSafeInteger(effect.signedAmountCents) ||
      Number(effect.signedAmountCents) === 0
    ) return null;
    ids.add(effectId);
    if (effectiveDate.epochDay <= asOf.epochDay) balance += Number(effect.signedAmountCents);
    if (!Number.isSafeInteger(balance)) return null;
  }
  return balance;
}

function sortedReasons(reasons: Set<ReceivablesSourceSnapshotReasonCode>) {
  return [...reasons].sort();
}

function evidenceState(value: unknown): ReceivablesShadowSourceState {
  return ["complete", "empty_confirmed", "unavailable", "ambiguous", "truncated"].includes(String(value))
    ? value as ReceivablesShadowSourceState
    : "unavailable";
}

function identityState(value: unknown): ReceivablesShadowSourceState {
  if (value === "resolved") return "complete";
  if (value === "ambiguous") return "ambiguous";
  return "unavailable";
}

export function buildReceivablesSourceSnapshot(
  input: ReceivablesSourceSnapshotAdapterInput
): InternalReceivablesSourceSnapshotPackage {
  const reasons = new Set<ReceivablesSourceSnapshotReasonCode>();
  const counts = sourceCounts(input);
  const records = allEvidenceRecords(input);
  const landlordId = cleanAccountingString(input.lease?.landlordId);
  const leaseId = cleanAccountingString(input.lease?.leaseId);
  const propertyId = cleanAccountingString(input.lease?.propertyId);
  const tenantId = cleanAccountingString(input.lease?.tenantId);

  const allowlist = parseExactAllowlist(input.comparatorConfig?.landlordAllowlist);
  if (
    (input.comparatorConfig?.enabled !== true && input.comparatorConfig?.enabled !== "true") ||
    !landlordId ||
    !allowlist?.includes(landlordId)
  ) reasons.add("SNAPSHOT_CONFIG_NOT_READY");

  if (input.ownership?.proofSource === "in_memory_fallback") reasons.add("SNAPSHOT_OWNERSHIP_FALLBACK_REJECTED");
  else if (input.ownership?.proofSource === "ambiguous") reasons.add("SNAPSHOT_OWNERSHIP_AMBIGUOUS");
  else if (input.ownership?.proofSource !== "authoritative_lease") reasons.add("SNAPSHOT_OWNERSHIP_MISSING");

  if (
    !landlordId || !leaseId || !propertyId ||
    cleanAccountingString(input.ownership?.landlordId) !== landlordId ||
    cleanAccountingString(input.ownership?.leaseId) !== leaseId ||
    cleanAccountingString(input.ownership?.leaseLandlordId) !== landlordId ||
    cleanAccountingString(input.ownership?.propertyId) !== propertyId ||
    cleanAccountingString(input.ownership?.propertyLandlordId) !== landlordId
  ) reasons.add("SNAPSHOT_SCOPE_MISMATCH");

  const mappingStates = [input.lease?.leaseMappingState, input.lease?.propertyMappingState, input.lease?.tenantMappingState];
  if (mappingStates.includes("ambiguous") || input.lease?.unitMappingState === "ambiguous") reasons.add("SNAPSHOT_MAPPING_AMBIGUOUS");
  if (mappingStates.some((state) => state !== "resolved") || !["resolved", "not_applicable"].includes(String(input.lease?.unitMappingState))) {
    reasons.add("SNAPSHOT_MAPPING_INCOMPLETE");
  }

  const asOf = parseDateOnly(input.asOfDate);
  const previewThrough = parseDateOnly(input.previewThroughDate);
  if (
    !asOf || !previewThrough || !parseDateOnly(input.lease?.leaseStartDate) ||
    !Number.isSafeInteger(input.lease?.monthlyRentCents) || Number(input.lease?.monthlyRentCents) <= 0 ||
    !Number.isInteger(input.lease?.dueDay) || Number(input.lease?.dueDay) < 1 || Number(input.lease?.dueDay) > 31 ||
    !cleanAccountingString(input.lease?.sourceLeaseVersion) ||
    !cleanAccountingString(input.lease?.propertyDisplayName) ||
    !cleanAccountingString(input.lease?.tenantDisplayName) ||
    !cleanAccountingString(input.lease?.responsibilityDisplayName) ||
    (input.lease?.unitMappingState === "resolved" && !cleanAccountingString(input.lease?.unitDisplayName))
  ) reasons.add("SNAPSHOT_BILLING_TERMS_INCOMPLETE");
  if (cleanAccountingString(input.lease?.currency, 8)?.toLowerCase() !== "cad") reasons.add("SNAPSHOT_CURRENCY_UNSUPPORTED");
  if (cleanAccountingString(input.lease?.billingFrequency, 40)?.toLowerCase() !== "monthly") reasons.add("SNAPSHOT_FREQUENCY_UNSUPPORTED");

  const completeness: ReceivablesShadowSourceCompleteness = {
    lease: identityState(input.lease?.leaseMappingState),
    property: identityState(input.lease?.propertyMappingState),
    unit: input.lease?.unitMappingState === "not_applicable" ? "empty_confirmed" : identityState(input.lease?.unitMappingState),
    tenantResponsibility: identityState(input.lease?.tenantMappingState),
    ledgerEntries: evidenceState(input.evidence?.ledgerEntries?.state),
    paymentRecords: evidenceState(input.evidence?.paymentRecords?.state),
    paymentIntents: evidenceState(input.evidence?.paymentIntents?.state),
    reconciliationRecords: evidenceState(input.evidence?.reconciliationRecords?.state),
    leaseObligations: evidenceState(input.evidence?.leaseObligations?.state),
    allocationRecords: evidenceState(input.evidence?.allocationRecords?.state),
  };
  for (const [key, state] of Object.entries(completeness)) {
    const identity = ["lease", "property", "tenantResponsibility"].includes(key);
    if (state === "ambiguous") reasons.add("SNAPSHOT_SOURCE_AMBIGUOUS");
    else if (identity ? state !== "complete" : state !== "complete" && state !== "empty_confirmed") reasons.add("SNAPSHOT_SOURCE_INCOMPLETE");
  }
  if (input.legacyEffectsState === "ambiguous") reasons.add("SNAPSHOT_SOURCE_AMBIGUOUS");
  else if (input.legacyEffectsState !== "complete" && input.legacyEffectsState !== "empty_confirmed") reasons.add("SNAPSHOT_SOURCE_INCOMPLETE");

  for (const [batchKey, expectedKind] of Object.entries(EXPECTED_BATCH_KIND) as Array<[keyof ReceivablesSnapshotEvidenceBatches, LegacyReceivablesSourceKind]>) {
    const batch = input.evidence?.[batchKey];
    if (batch?.state === "empty_confirmed" && (batch.records?.length || 0) > 0) {
      reasons.add("SNAPSHOT_SOURCE_INCOMPLETE");
    }
    if ((batch?.records || []).some((record) => record.sourceKind !== expectedKind)) {
      reasons.add("SNAPSHOT_SOURCE_BATCH_KIND_MISMATCH");
    }
  }
  if (input.legacyEffectsState === "empty_confirmed" && (input.legacyEffects?.length || 0) > 0) {
    reasons.add("SNAPSHOT_SOURCE_INCOMPLETE");
  }
  if (containsUnsafeData({ evidence: input.evidence, legacyEffects: input.legacyEffects })) reasons.add("SNAPSHOT_UNSAFE_SOURCE_DATA");

  const ownershipVerified = ![
    "SNAPSHOT_OWNERSHIP_MISSING", "SNAPSHOT_OWNERSHIP_FALLBACK_REJECTED", "SNAPSHOT_OWNERSHIP_AMBIGUOUS", "SNAPSHOT_SCOPE_MISMATCH",
  ].some((code) => reasons.has(code as ReceivablesSourceSnapshotReasonCode));
  const proof = { state: ownershipVerified ? "independently_verified" as const : "unverified" as const, landlordId, leaseId };
  const normalizationInput = {
    landlordId,
    leaseId,
    propertyId,
    tenantId,
    tenantMappingState: input.lease?.tenantMappingState,
    ownershipProof: proof,
    records,
  };
  const normalization = reasons.size === 0 ? normalizeLegacyReceivablesSources(normalizationInput) : null;
  if (normalization && normalization.sourceState !== "complete") reasons.add("SNAPSHOT_NORMALIZATION_FAILED");

  if (input.legacyEffectsState === "unavailable" || input.legacyEffectsState === "truncated") {
    reasons.add("SNAPSHOT_LEGACY_PROJECTION_UNAVAILABLE");
  }
  const legacyBalance = reasons.size === 0 ? independentLegacyBalance(input) : null;
  if (reasons.size === 0 && legacyBalance === null) reasons.add("SNAPSHOT_LEGACY_PROJECTION_INVALID");

  const finalReasons = sortedReasons(reasons);
  const ready = finalReasons.length === 0 && legacyBalance !== null;
  const comparatorInput = ready ? {
    config: input.comparatorConfig,
    requestLandlordId: landlordId,
    ownershipProof: proof,
    sourceCompleteness: completeness,
    normalizationInput,
    dtoInput: {
      leaseId,
      propertyId,
      unitId: input.lease.unitId,
      responsibilityId: input.lease.responsibilityId,
      tenantId,
      propertyDisplayName: input.lease.propertyDisplayName,
      unitDisplayName: input.lease.unitDisplayName,
      tenantDisplayName: input.lease.tenantDisplayName,
      responsibilityDisplayName: input.lease.responsibilityDisplayName,
      tenantMappingState: input.lease.tenantMappingState,
      leaseStatus: input.lease.leaseStatus,
      leaseStartDate: input.lease.leaseStartDate,
      leaseEndDate: input.lease.leaseEndDate,
      monthlyRentCents: input.lease.monthlyRentCents,
      dueDay: input.lease.dueDay,
      billingFrequency: input.lease.billingFrequency,
      currency: input.lease.currency,
      depositAmountCents: input.lease.depositAmountCents,
      sourceLeaseVersion: input.lease.sourceLeaseVersion,
      asOfDate: input.asOfDate,
      previewThroughDate: input.previewThroughDate,
      agingAllocationPolicy: "explicit" as const,
    },
    legacyProjection: { state: "available" as const, balanceCents: legacyBalance },
  } : null;

  return {
    snapshotVersion: RECEIVABLES_SOURCE_SNAPSHOT_VERSION,
    status: ready ? "ready" : statusForReasons(finalReasons),
    reasonCodes: finalReasons,
    warnings: [],
    ownershipVerified,
    completenessStatus: ready ? "complete" : finalReasons.some((code) => code.includes("AMBIGUOUS")) ? "ambiguous" : "incomplete",
    sourceCounts: counts,
    normalizedSourceSummary: {
      status: normalization?.sourceState || "not_run",
      recordCount: records.length,
      legacyEffectCount: input.legacyEffects?.length || 0,
    },
    comparatorInput,
  };
}
