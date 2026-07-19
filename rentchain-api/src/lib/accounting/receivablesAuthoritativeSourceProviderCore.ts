import { normalizeLegacyReceivablesSources } from "./legacyReceivablesSourceNormalizer";
import type { LegacyReceivablesSourceKind, LegacyReceivablesSourceRecord } from "./legacyReceivablesSourceTypes";
import {
  RECEIVABLES_AUTHORITATIVE_SOURCE_MANIFEST_VERSION,
  RECEIVABLES_AUTHORITATIVE_SOURCE_PROVIDER_VERSION,
  type BuildReceivablesAuthoritativeSourceInput,
  type ReceivablesAuthoritativeReadReceipt,
  type ReceivablesAuthoritativeSourceClass,
  type ReceivablesAuthoritativeSourceProviderReasonCode,
  type ReceivablesAuthoritativeSourceProviderResult,
} from "./receivablesAuthoritativeSourceProviderTypes";
import type { IndependentLegacySignedEffect, ReceivablesSnapshotEvidenceBatch } from "./receivablesSourceSnapshotTypes";
import { cleanAccountingString, parseDateOnly } from "./receivablesTypes";

const RECEIPT_KEYS = ["ownership", "lease", "property", "unit", "tenant", "ledger", "payment", "paymentIntent", "reconciliation", "obligation", "allocation", "legacyEffects"] as const;
const EXPECTED_CLASSES: Record<(typeof RECEIPT_KEYS)[number], ReceivablesAuthoritativeSourceClass> = {
  ownership: "ownership", lease: "lease", property: "property", unit: "unit", tenant: "tenant",
  ledger: "ledger", payment: "payment", paymentIntent: "payment_intent", reconciliation: "reconciliation",
  obligation: "obligation", allocation: "allocation", legacyEffects: "legacy_effects",
};
const EXPECTED_KINDS: Record<string, LegacyReceivablesSourceKind> = {
  ledger: "ledger_entry", payment: "payment_record", paymentIntent: "payment_intent",
  reconciliation: "reconciliation_record", obligation: "lease_obligation", allocation: "allocation_record",
};
const UNSAFE_KEY = /(provider|processor|firestore|storage|bank|routing|transit|institution|iban|swift|credential|secret|token|admin|internalScope|createdByEmail|reversedByEmail)/i;
const UNSAFE_VALUE = /^(?:gs:\/\/|firestore:\/\/)|\/(?:b|v1)\/documents\//i;

function unsafe(value: unknown, seen = new Set<object>()): boolean {
  if (typeof value === "string") return UNSAFE_VALUE.test(value.trim());
  if (!value || typeof value !== "object") return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.some((item) => unsafe(item, seen));
  return Object.entries(value as Record<string, unknown>).some(([key, item]) => UNSAFE_KEY.test(key) || unsafe(item, seen));
}

function result(reasons: Set<ReceivablesAuthoritativeSourceProviderReasonCode>, acceptedCount: number, completeCount: number, emptyCount: number, snapshot: ReceivablesAuthoritativeSourceProviderResult["safeSnapshotInput"] = null): ReceivablesAuthoritativeSourceProviderResult {
  const reasonCodes = [...reasons].sort();
  const ambiguous = reasonCodes.some((code) => code.includes("AMBIGUOUS"));
  const isUnsafe = reasonCodes.includes("PROVIDER_UNSAFE_SOURCE_DATA");
  const safe = reasonCodes.length === 0 && Boolean(snapshot);
  return {
    providerCoreVersion: RECEIVABLES_AUTHORITATIVE_SOURCE_PROVIDER_VERSION,
    status: safe ? "safe" : isUnsafe ? "unsafe" : ambiguous ? "ambiguous" : "not_ready",
    reasonCodes,
    warnings: [],
    ownershipProofSummary: { status: safe ? "verified" : ambiguous ? "ambiguous" : "unverified", method: safe ? "canonical_direct" : "none" },
    sourceCompletenessSummary: { status: safe ? "complete" : ambiguous ? "ambiguous" : "incomplete", completeCount, emptyCount },
    safeSnapshotInput: safe ? snapshot : null,
    unsafeFieldSummary: { detected: isUnsafe, categories: isUnsafe ? ["restricted_source_field"] : [] },
    receiptSummary: { requiredCount: RECEIPT_KEYS.length, acceptedCount, manifestVersion: RECEIVABLES_AUTHORITATIVE_SOURCE_MANIFEST_VERSION },
  };
}

export function buildReceivablesAuthoritativeSource(
  input: BuildReceivablesAuthoritativeSourceInput
): ReceivablesAuthoritativeSourceProviderResult {
  const reasons = new Set<ReceivablesAuthoritativeSourceProviderReasonCode>();
  if (input.providerEnabled !== true) reasons.add("PROVIDER_DISABLED");
  if (input.sourceManifestVersion !== RECEIVABLES_AUTHORITATIVE_SOURCE_MANIFEST_VERSION) reasons.add("PROVIDER_MANIFEST_VERSION_MISMATCH");
  const landlordId = cleanAccountingString(input.target?.landlordId);
  const leaseId = cleanAccountingString(input.target?.leaseId);
  const context = cleanAccountingString(input.target?.context);
  const asOf = parseDateOnly(input.asOfDate);
  const previewThrough = parseDateOnly(input.previewThroughDate);
  if (!landlordId || !leaseId || context !== "lease_receivables" || !asOf || !previewThrough) reasons.add("PROVIDER_TARGET_INVALID");

  let acceptedCount = 0;
  let completeCount = 0;
  let emptyCount = 0;
  let boundary: string | null = null;
  for (const key of RECEIPT_KEYS) {
    const receipt = input.receipts?.[key] as ReceivablesAuthoritativeReadReceipt<unknown> | undefined;
    if (!receipt) { reasons.add("PROVIDER_RECEIPT_MISSING"); continue; }
    if (receipt.sourceClass !== EXPECTED_CLASSES[key]) reasons.add("PROVIDER_RECEIPT_CLASS_MISMATCH");
    const sourceVersion = cleanAccountingString(receipt.sourceVersion);
    const readBoundary = cleanAccountingString(receipt.readBoundaryVersion);
    if (!sourceVersion || !readBoundary) reasons.add("PROVIDER_RECEIPT_VERSION_MISSING");
    else if (boundary && boundary !== readBoundary) reasons.add("PROVIDER_READ_BOUNDARY_MISMATCH");
    else boundary = readBoundary;
    if (receipt.authoritative !== true) reasons.add("PROVIDER_SOURCE_NOT_AUTHORITATIVE");
    if (receipt.suitableForFinancialDiagnostics !== true) reasons.add("PROVIDER_SOURCE_UNSUITABLE");
    if (receipt.aliasOwnershipMapping === true) reasons.add("PROVIDER_SOURCE_ALIAS_REJECTED");
    if (receipt.postReadFiltered === true) reasons.add("PROVIDER_SOURCE_POST_FILTER_REJECTED");
    if (receipt.catchToEmpty === true) reasons.add("PROVIDER_SOURCE_CATCH_TO_EMPTY_REJECTED");
    if (receipt.capped === true && receipt.completenessProven !== true) reasons.add("PROVIDER_SOURCE_CAPPED_INCOMPLETE");
    if (!["complete", "empty_confirmed"].includes(String(receipt.completenessState))) reasons.add(receipt.completenessState === "ambiguous" ? "PROVIDER_MAPPING_AMBIGUOUS" : "PROVIDER_SOURCE_INCOMPLETE");
    if (receipt.completenessState === "empty_confirmed" && receipt.records.length) reasons.add("PROVIDER_SOURCE_STATE_CONFLICT");
    if (receipt.completenessState === "complete" && !receipt.records.length) reasons.add("PROVIDER_SOURCE_STATE_CONFLICT");
    if (cleanAccountingString(receipt.scope?.landlordId) !== landlordId || cleanAccountingString(receipt.scope?.leaseId) !== leaseId) reasons.add("PROVIDER_SCOPE_MISMATCH");
    if (unsafe(receipt.records)) reasons.add("PROVIDER_UNSAFE_SOURCE_DATA");
    if (receipt.completenessState === "complete") completeCount += 1;
    if (receipt.completenessState === "empty_confirmed") emptyCount += 1;
    acceptedCount += 1;
  }

  if (reasons.size || !landlordId || !leaseId || !asOf || !previewThrough) return result(reasons, acceptedCount, completeCount, emptyCount);
  const receipts = input.receipts!;
  const ownership = receipts.ownership!.records[0];
  const lease = receipts.lease!.records[0];
  const property = receipts.property!.records[0];
  if (!ownership || !lease || !property) reasons.add("PROVIDER_OWNERSHIP_MISSING");
  if (ownership?.proofSource === "ambiguous") reasons.add("PROVIDER_OWNERSHIP_AMBIGUOUS");
  if (
    ownership?.proofSource !== "canonical_direct" || lease?.directDocument !== true || lease?.ownershipField !== "landlordId" ||
    lease?.ownershipAliasConflict === true || cleanAccountingString(ownership?.landlordId) !== landlordId ||
    cleanAccountingString(ownership?.leaseId) !== leaseId || cleanAccountingString(ownership?.leaseLandlordId) !== landlordId ||
    cleanAccountingString(ownership?.propertyLandlordId) !== landlordId || cleanAccountingString(lease?.canonicalLandlordId) !== landlordId
  ) reasons.add("PROVIDER_OWNERSHIP_UNVERIFIED");
  const propertyId = cleanAccountingString(lease?.propertyId);
  if (!propertyId || cleanAccountingString(ownership?.propertyId) !== propertyId || cleanAccountingString(property?.propertyId) !== propertyId || cleanAccountingString(property?.landlordId) !== landlordId) reasons.add("PROVIDER_MAPPING_CONFLICT");

  const unitId = cleanAccountingString(lease?.unitId);
  const tenantId = cleanAccountingString(lease?.tenantId);
  const responsibilityId = cleanAccountingString(lease?.responsibilityId);
  const unit = receipts.unit!.records[0];
  const tenant = receipts.tenant!.records[0];
  if (unitId) {
    if (!unit || cleanAccountingString(unit.unitId) !== unitId || cleanAccountingString(unit.propertyId) !== propertyId || cleanAccountingString(unit.landlordId) !== landlordId) reasons.add("PROVIDER_MAPPING_CONFLICT");
  } else if (receipts.unit!.completenessState !== "empty_confirmed") reasons.add("PROVIDER_MAPPING_INCOMPLETE");
  if (!tenantId || !tenant || cleanAccountingString(tenant.tenantId) !== tenantId || cleanAccountingString(tenant.leaseId) !== leaseId || !responsibilityId) reasons.add("PROVIDER_MAPPING_CONFLICT");
  const labels = [property?.displayName, unitId ? unit?.displayName : "not_applicable", tenant?.displayName, lease?.responsibilityDisplayName].map((value) => cleanAccountingString(value));
  if (labels.some((value) => !value)) reasons.add("PROVIDER_DISPLAY_LABEL_MISSING");
  if ([propertyId, unitId, tenantId, responsibilityId].filter(Boolean).some((id) => labels.includes(id))) reasons.add("PROVIDER_DISPLAY_ID_FALLBACK_REJECTED");

  const evidenceKeys = ["ledger", "payment", "paymentIntent", "reconciliation", "obligation", "allocation"] as const;
  const records: LegacyReceivablesSourceRecord[] = [];
  for (const key of evidenceKeys) {
    const receipt = receipts[key]!;
    const expectedKind = EXPECTED_KINDS[key];
    if (receipt.records.some((record) => record.sourceKind !== expectedKind)) reasons.add("PROVIDER_EVIDENCE_KIND_MISMATCH");
    records.push(...receipt.records);
  }
  const normalization = normalizeLegacyReceivablesSources({
    landlordId, leaseId, propertyId: propertyId || "", tenantId,
    tenantMappingState: "resolved", ownershipProof: { state: "independently_verified", landlordId, leaseId }, records,
  });
  if (normalization.sourceState !== "complete" || normalization.findings.some((finding) => finding.severity === "error")) reasons.add("PROVIDER_CANONICAL_NORMALIZATION_FAILED");
  if (reasons.size || !propertyId || !tenantId || !responsibilityId) return result(reasons, acceptedCount, completeCount, emptyCount);

  const batch = (key: typeof evidenceKeys[number]): ReceivablesSnapshotEvidenceBatch => ({
    state: receipts[key]!.completenessState, records: receipts[key]!.records,
  });
  const snapshot = {
    comparatorConfig: input.comparatorConfig,
    ownership: { proofSource: "authoritative_lease", landlordId, leaseId, leaseLandlordId: landlordId, propertyId, propertyLandlordId: landlordId },
    lease: {
      ...lease, landlordId, leaseId, propertyId, unitId, tenantId, responsibilityId,
      propertyDisplayName: cleanAccountingString(property.displayName),
      unitDisplayName: unitId ? cleanAccountingString(unit!.displayName) : null,
      tenantDisplayName: cleanAccountingString(tenant.displayName),
      leaseMappingState: "resolved", propertyMappingState: "resolved",
      unitMappingState: unitId ? "resolved" : "not_applicable", tenantMappingState: "resolved",
    },
    evidence: {
      ledgerEntries: batch("ledger"), paymentRecords: batch("payment"), paymentIntents: batch("paymentIntent"),
      reconciliationRecords: batch("reconciliation"), leaseObligations: batch("obligation"), allocationRecords: batch("allocation"),
    },
    legacyEffectsState: receipts.legacyEffects!.completenessState,
    legacyEffects: receipts.legacyEffects!.records as readonly IndependentLegacySignedEffect[],
    asOfDate: asOf.value, previewThroughDate: previewThrough.value,
  };
  return result(reasons, acceptedCount, completeCount, emptyCount, snapshot);
}
