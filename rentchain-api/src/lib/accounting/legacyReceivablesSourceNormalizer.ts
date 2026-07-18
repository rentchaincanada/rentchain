import crypto from "crypto";
import {
  LEGACY_RECEIVABLES_SOURCE_KINDS,
  type LegacyReceivablesSourceFinding,
  type LegacyReceivablesSourceKind,
  type LegacyReceivablesSourceNormalizationResult,
  type LegacyReceivablesSourceRecord,
  type NormalizeLegacyReceivablesSourcesInput,
} from "./legacyReceivablesSourceTypes";
import {
  cleanAccountingString,
  normalizeReceivableTransaction,
  sortReceivableFindings,
  type ReceivableTransaction,
} from "./receivablesTypes";

const SOURCE_KINDS = new Set<string>(LEGACY_RECEIVABLES_SOURCE_KINDS);
const EVIDENCE_ROLES = new Set(["posted_transaction", "preview_obligation", "corroborating_evidence"]);
const SOURCE_PRECEDENCE: Record<LegacyReceivablesSourceKind, number> = {
  ledger_entry: 600,
  payment_record: 500,
  allocation_record: 400,
  reconciliation_record: 300,
  lease_obligation: 200,
  payment_intent: 100,
};

type ValidatedRecord = {
  sourceKind: LegacyReceivablesSourceKind;
  sourceId: string;
  evidenceRole: string;
  canonicalEventKey: string | null;
  linkedSourceIds: string[];
  transaction: ReceivableTransaction | null;
  source: LegacyReceivablesSourceRecord;
};

function fingerprint(value: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function finding(
  code: string,
  severity: "error" | "review" | "info",
  record?: Partial<ValidatedRecord>,
  field?: string
): LegacyReceivablesSourceFinding {
  return {
    code,
    severity,
    ...(record?.sourceKind ? { sourceKind: record.sourceKind } : {}),
    ...(record?.sourceId ? { sourceId: record.sourceId } : {}),
    ...(field ? { field } : {}),
  };
}

function transactionShape(transaction: ReceivableTransaction): string {
  return JSON.stringify({
    leaseId: transaction.leaseId,
    propertyId: transaction.propertyId,
    unitId: transaction.unitId,
    responsibilityId: transaction.responsibilityId,
    tenantId: transaction.tenantId,
    type: transaction.type,
    amountCents: transaction.amountCents,
    currency: transaction.currency,
    effectiveDate: transaction.effectiveDate,
    dueDate: transaction.dueDate,
    periodStart: transaction.periodStart,
    periodEnd: transaction.periodEnd,
    reversesTransactionId: transaction.reversesTransactionId,
    appliesToTransactionId: transaction.appliesToTransactionId,
    metadata: transaction.metadata,
  });
}

function sortSourceFindings(findings: LegacyReceivablesSourceFinding[]) {
  return [...findings].sort((a, b) =>
    [a.code, a.sourceKind || "", a.sourceId || "", a.field || "", a.severity]
      .join(":")
      .localeCompare([b.code, b.sourceKind || "", b.sourceId || "", b.field || "", b.severity].join(":"))
  );
}

function normalizeRecord(
  source: LegacyReceivablesSourceRecord,
  scope: { landlordId: string; leaseId: string; propertyId: string },
  findings: LegacyReceivablesSourceFinding[]
): ValidatedRecord | null {
  const sourceKindValue = cleanAccountingString(source.sourceKind, 80);
  const sourceKind = sourceKindValue && SOURCE_KINDS.has(sourceKindValue)
    ? (sourceKindValue as LegacyReceivablesSourceKind)
    : null;
  const sourceId = cleanAccountingString(source.sourceId);
  if (!sourceKind) findings.push(finding("legacy_source_kind_unsupported", "error", {}, "sourceKind"));
  if (!sourceId) findings.push(finding("legacy_source_id_missing", "error", {}, "sourceId"));
  if (!sourceKind || !sourceId) return null;

  const partial = { sourceKind, sourceId };
  const evidenceRole = cleanAccountingString(source.evidenceRole, 40);
  if (!evidenceRole || !EVIDENCE_ROLES.has(evidenceRole)) {
    findings.push(finding("legacy_evidence_role_unsupported", "error", partial, "evidenceRole"));
    return null;
  }
  if (cleanAccountingString(source.landlordId) !== scope.landlordId) {
    findings.push(finding("legacy_landlord_scope_mismatch", "error", partial, "landlordId"));
  }
  if (cleanAccountingString(source.leaseId) !== scope.leaseId) {
    findings.push(finding("legacy_lease_scope_mismatch", "error", partial, "leaseId"));
  }
  if (cleanAccountingString(source.propertyId) !== scope.propertyId) {
    findings.push(finding("legacy_property_scope_mismatch", "error", partial, "propertyId"));
  }

  const canonicalEventKey = cleanAccountingString(source.canonicalEventKey);
  const linkedSourceIds = Array.from(
    new Set((source.linkedSourceIds || []).map((value) => cleanAccountingString(value)).filter((value): value is string => Boolean(value)))
  ).sort();

  if (evidenceRole === "corroborating_evidence") {
    if (source.transactionType || source.amountCents !== undefined) {
      findings.push(finding("corroborating_evidence_cannot_create_transaction", "error", partial));
    }
    return { sourceKind, sourceId, evidenceRole, canonicalEventKey, linkedSourceIds, transaction: null, source };
  }
  if (sourceKind === "payment_intent") {
    findings.push(finding("payment_intent_cannot_create_receivable_transaction", "error", partial));
    return { sourceKind, sourceId, evidenceRole, canonicalEventKey, linkedSourceIds, transaction: null, source };
  }
  if (sourceKind === "reconciliation_record" && evidenceRole !== "corroborating_evidence") {
    findings.push(finding("reconciliation_cannot_invent_receivable_transaction", "error", partial));
    return { sourceKind, sourceId, evidenceRole, canonicalEventKey, linkedSourceIds, transaction: null, source };
  }
  if (sourceKind === "allocation_record") {
    findings.push(finding("allocation_record_cannot_create_receivable_transaction", "error", partial));
    return { sourceKind, sourceId, evidenceRole, canonicalEventKey, linkedSourceIds, transaction: null, source };
  }
  if (sourceKind === "payment_record" && source.transactionType !== "payment_applied" && source.transactionType !== "payment_reversal") {
    findings.push(finding("payment_record_transaction_type_unsupported", "error", partial, "transactionType"));
    return { sourceKind, sourceId, evidenceRole, canonicalEventKey, linkedSourceIds, transaction: null, source };
  }
  if (sourceKind === "lease_obligation" && evidenceRole !== "preview_obligation") {
    findings.push(finding("lease_obligation_must_remain_preview", "error", partial, "evidenceRole"));
    return { sourceKind, sourceId, evidenceRole, canonicalEventKey, linkedSourceIds, transaction: null, source };
  }

  const normalized = normalizeReceivableTransaction({
    transactionId: `${sourceKind}:${sourceId}`,
    leaseId: source.leaseId,
    propertyId: source.propertyId,
    unitId: source.unitId,
    responsibilityId: source.responsibilityId,
    tenantId: source.tenantId,
    type: source.transactionType,
    amountCents: source.amountCents,
    currency: source.currency,
    effectiveDate: source.effectiveDate,
    dueDate: source.dueDate,
    periodStart: source.periodStart,
    periodEnd: source.periodEnd,
    sourceRef: `${sourceKind}:${sourceId}`,
    sourceVersion: source.sourceVersion,
    reversesTransactionId: cleanAccountingString(source.reversesSourceId),
    appliesToTransactionId: cleanAccountingString(source.appliesToSourceId),
    metadata: { adjustmentDirection: source.adjustmentDirection },
  });
  findings.push(...sortReceivableFindings(normalized.findings).map((item) => ({ ...item, sourceKind, sourceId })));
  return { sourceKind, sourceId, evidenceRole, canonicalEventKey, linkedSourceIds, transaction: normalized.transaction, source };
}

function explicitlyLinked(left: ValidatedRecord, right: ValidatedRecord): boolean {
  return Boolean(
    (left.canonicalEventKey && left.canonicalEventKey === right.canonicalEventKey) ||
      left.linkedSourceIds.includes(right.sourceId) ||
      right.linkedSourceIds.includes(left.sourceId)
  );
}

export function normalizeLegacyReceivablesSources(
  input: NormalizeLegacyReceivablesSourcesInput
): LegacyReceivablesSourceNormalizationResult {
  const findings: LegacyReceivablesSourceFinding[] = [];
  const landlordId = cleanAccountingString(input.landlordId);
  const leaseId = cleanAccountingString(input.leaseId);
  const propertyId = cleanAccountingString(input.propertyId);
  const proofLandlordId = cleanAccountingString(input.ownershipProof?.landlordId);
  const proofLeaseId = cleanAccountingString(input.ownershipProof?.leaseId);

  if (!landlordId || !leaseId || !propertyId) findings.push(finding("legacy_normalization_scope_incomplete", "error"));
  if (
    input.ownershipProof?.state !== "independently_verified" ||
    !landlordId ||
    !leaseId ||
    proofLandlordId !== landlordId ||
    proofLeaseId !== leaseId
  ) {
    findings.push(finding("landlord_ownership_not_independently_verified", "error"));
  }
  if (input.tenantMappingState === "ambiguous") findings.push(finding("tenant_mapping_ambiguous", "error"));
  else if (input.tenantMappingState !== "resolved") findings.push(finding("tenant_mapping_incomplete", "error"));

  if (findings.some((item) => item.severity === "error") || !landlordId || !leaseId || !propertyId) {
    const sorted = sortSourceFindings(findings);
    return { sourceState: input.tenantMappingState === "ambiguous" ? "ambiguous" : "incomplete", transactions: [], findings: sorted, sourceFingerprint: fingerprint(sorted) };
  }

  const validated = input.records
    .map((record) => normalizeRecord(record, { landlordId, leaseId, propertyId }, findings))
    .filter((record): record is ValidatedRecord => Boolean(record));
  const duplicateIds = new Set<string>();
  for (const record of validated) {
    if (duplicateIds.has(record.sourceId)) findings.push(finding("duplicate_legacy_source_id", "error", record));
    duplicateIds.add(record.sourceId);
  }

  const transactional = validated.filter((record) => record.transaction);
  const used = new Set<string>();
  const selected: ValidatedRecord[] = [];
  for (const record of [...transactional].sort((a, b) => a.sourceId.localeCompare(b.sourceId))) {
    if (used.has(record.sourceId)) continue;
    const group = transactional.filter(
      (candidate) => !used.has(candidate.sourceId) && (candidate.sourceId === record.sourceId || explicitlyLinked(record, candidate))
    );
    group.forEach((candidate) => used.add(candidate.sourceId));
    if (group.length === 1) {
      selected.push(record);
      continue;
    }
    if (new Set(group.map((candidate) => candidate.sourceKind)).size !== group.length) {
      findings.push(finding("ambiguous_duplicate_source_evidence", "error", record));
      continue;
    }
    const shapes = new Set(group.map((candidate) => transactionShape(candidate.transaction!)));
    if (shapes.size !== 1) {
      findings.push(finding("conflicting_linked_financial_evidence", "error", record));
      continue;
    }
    selected.push(
      [...group].sort((a, b) => SOURCE_PRECEDENCE[b.sourceKind] - SOURCE_PRECEDENCE[a.sourceKind] || a.sourceId.localeCompare(b.sourceId))[0]
    );
  }

  const exactGroups = new Map<string, ValidatedRecord[]>();
  for (const record of selected) {
    const key = transactionShape(record.transaction!);
    exactGroups.set(key, [...(exactGroups.get(key) || []), record]);
  }
  for (const group of exactGroups.values()) {
    if (group.length > 1) findings.push(finding("unlinked_exact_match_requires_review", "error", group[0]));
  }

  const sortedFindings = sortSourceFindings(findings);
  const hasErrors = sortedFindings.some((item) => item.severity === "error");
  const canonicalIdFor = (record: ValidatedRecord) =>
    record.canonicalEventKey ? `legacy_event:${record.canonicalEventKey}` : `${record.sourceKind}:${record.sourceId}`;
  const sourceToCanonicalId = new Map<string, string>();
  for (const record of selected) {
    const canonicalId = canonicalIdFor(record);
    for (const candidate of transactional) {
      if (candidate.sourceId === record.sourceId || explicitlyLinked(record, candidate)) {
        sourceToCanonicalId.set(candidate.sourceId, canonicalId);
      }
    }
  }
  const transactions = hasErrors
    ? []
    : selected
        .map((record) => {
          const canonicalTransactionId = canonicalIdFor(record);
          return {
            ...record.transaction!,
            transactionId: canonicalTransactionId,
            sourceRef: canonicalTransactionId,
            reversesTransactionId: record.transaction!.reversesTransactionId
              ? sourceToCanonicalId.get(record.transaction!.reversesTransactionId) || record.transaction!.reversesTransactionId
              : null,
            appliesToTransactionId: record.transaction!.appliesToTransactionId
              ? sourceToCanonicalId.get(record.transaction!.appliesToTransactionId) || record.transaction!.appliesToTransactionId
              : null,
          };
        })
        .sort((a, b) => [a.effectiveDate, a.transactionId].join(":").localeCompare([b.effectiveDate, b.transactionId].join(":")));
  const sourceState = hasErrors
    ? sortedFindings.some((item) => item.code.includes("ambiguous") || item.code.includes("conflicting") || item.code.includes("duplicate") || item.code.includes("unlinked"))
      ? "ambiguous"
      : "incomplete"
    : "complete";
  return {
    sourceState,
    transactions,
    findings: sortedFindings,
    sourceFingerprint: fingerprint({ sourceState, transactions, findings: sortedFindings }),
  };
}
