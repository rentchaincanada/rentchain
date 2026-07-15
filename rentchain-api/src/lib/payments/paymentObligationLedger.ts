import type { LeaseLifecycleState } from "../leases/leaseLifecycle";
import type { PaymentIntentRecord, PaymentIntentStatus } from "./paymentIntents";
import type { PaymentReconciliationStatus } from "./paymentReconciliation";
import type { RentPaymentRecord, RentPaymentStatus } from "../../services/rentPayments/rentPaymentService";

export type PaymentObligationStatus =
  | "expected"
  | "pending"
  | "paid"
  | "underpaid"
  | "overpaid"
  | "failed"
  | "missing"
  | "manual_review_required"
  | "unknown";

export type PaymentObligationLedgerSource =
  | "lease_lifecycle"
  | "payment_intent"
  | "rent_payment"
  | "canonical_payment"
  | "reconciliation";

export type PaymentObligationLedgerRow = {
  rowId: string;
  leaseId: string;
  paymentIntentId?: string | null;
  rentPaymentId?: string | null;
  paymentDocumentId?: string | null;
  propertyId: string | null;
  unitId?: string | null;
  tenantId?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  dueDate?: string | null;
  expectedAmountCents: number;
  paidAmountCents?: number;
  currency: string;
  obligationStatus: PaymentObligationStatus;
  paymentIntentStatus?: PaymentIntentStatus | null;
  rentPaymentStatus?: RentPaymentStatus | null;
  reconciliationStatus?: PaymentReconciliationStatus | null;
  evidenceStatus?: "none" | "provider_received" | "reconciled" | "manual_review_required" | "failed" | "pending";
  source: PaymentObligationLedgerSource;
  reasons: string[];
  allocatedFromCreditCents?: number;
  outstandingAfterAllocationCents?: number;
  allocationStatus?: "none" | "partially_allocated" | "fully_allocated";
  activeAllocationIds?: string[];
  allocationAdjustedFinancialSignal?: "credit_allocation_recorded" | "allocation_review" | null;
  allocationDisplayReason?: string | null;
};

export type PaymentObligationLedgerSummary = {
  totalRows: number;
  expectedAmountCents: number;
  paidAmountCents: number;
  outstandingAmountCents: number;
  totalAllocatedCreditCents?: number;
  totalOutstandingAfterAllocationCents?: number;
  allocationAdjustedOutstandingCents?: number;
  availableCreditAfterAllocationCents?: number | null;
  statusCounts: Record<PaymentObligationStatus, number>;
  manualReviewCount: number;
};

export type PaymentObligationLeaseInput = {
  id?: string | null;
  leaseId?: string | null;
  landlordId?: string | null;
  propertyId?: string | null;
  unitId?: string | null;
  tenantId?: string | null;
  primaryTenantId?: string | null;
  monthlyRent?: number | null;
  amountCents?: number | null;
  currency?: string | null;
  startDate?: string | null;
  leaseStartDate?: string | null;
  leaseStart?: string | null;
  endDate?: string | null;
  leaseEndDate?: string | null;
  leaseEnd?: string | null;
  dueDate?: string | null;
  dueDay?: number | string | null;
  rentDueDay?: number | string | null;
  paymentDueDay?: number | string | null;
  rentDueDayOfMonth?: number | string | null;
  rentSchedule?: Record<string, unknown> | null;
  paymentTerms?: Record<string, unknown> | null;
  paymentFrequency?: string | null;
  derivedLifecycleState?: LeaseLifecycleState | null;
  derivedLifecycleRequiresReview?: boolean | null;
  status?: string | null;
};

export type PaymentObligationReconciliationInput = {
  reconciliationId?: string | null;
  paymentIntentId?: string | null;
  rentPaymentId?: string | null;
  subjectId?: string | null;
  reconciliationStatus?: PaymentReconciliationStatus | string | null;
  requiresManualReview?: boolean | null;
  reasons?: string[] | null;
};

export type PaymentObligationCanonicalPaymentInput = {
  id?: string | null;
  paymentDocumentId?: string | null;
  leaseId?: string | null;
  tenantId?: string | null;
  landlordId?: string | null;
  propertyId?: string | null;
  unitId?: string | null;
  amountCents?: number | null;
  currency?: string | null;
  status?: string | null;
  paidAt?: string | null;
  effectiveDate?: string | null;
  method?: string | null;
  reference?: string | null;
  source?: string | null;
  ledgerEntryId?: string | null;
};

export type BuildPaymentObligationLedgerRowsInput = {
  leases?: PaymentObligationLeaseInput[];
  paymentIntents?: PaymentIntentRecord[];
  rentPayments?: RentPaymentRecord[];
  canonicalPayments?: PaymentObligationCanonicalPaymentInput[];
  reconciliationRecords?: PaymentObligationReconciliationInput[];
  creditAllocationRecords?: PaymentObligationCreditAllocationInput[];
};

export type PaymentObligationCreditAllocationInput = {
  allocationId?: string | null;
  landlordId?: string | null;
  leaseId?: string | null;
  obligationRowId?: string | null;
  obligationKey?: string | null;
  allocationAmountCents?: number | null;
  status?: "active" | "reversed" | string | null;
};

export type SummarizePaymentObligationLedgerOptions = {
  aggregateBalanceCents?: number | null;
};

type StatusInput = {
  expectedAmountCents: number;
  paidAmountCents: number;
  paymentIntentStatus?: PaymentIntentStatus | null;
  rentPaymentStatus?: RentPaymentStatus | null;
  reconciliationStatus?: PaymentReconciliationStatus | string | null;
  requiresManualReview?: boolean | null;
  hasPaymentEvidence?: boolean;
  hasPaymentIntent?: boolean;
  hasRentPayment?: boolean;
  hasCanonicalPayment?: boolean;
  hasLeaseObligation?: boolean;
};

const REVIEW_RECONCILIATION_STATUSES = new Set(["manual_review_required", "mismatch", "duplicate_risk"]);
const PENDING_RECONCILIATION_STATUSES = new Set(["pending_provider_confirmation", "pending_settlement", "not_started"]);
const FAILED_RECONCILIATION_STATUSES = new Set(["failed"]);
const FAILED_RENT_PAYMENT_STATUSES = new Set<RentPaymentStatus>(["failed", "canceled", "expired"]);
const PENDING_RENT_PAYMENT_STATUSES = new Set<RentPaymentStatus>(["setup_required", "checkout_created", "payment_pending"]);
const FAILED_PAYMENT_INTENT_STATUSES = new Set<PaymentIntentStatus>(["failed", "cancelled", "expired"]);
const PENDING_PAYMENT_INTENT_STATUSES = new Set<PaymentIntentStatus>([
  "draft",
  "ready",
  "provider_session_created",
  "pending_provider_confirmation",
  "pending_settlement",
]);
const PAID_PAYMENT_INTENT_STATUSES = new Set<PaymentIntentStatus>(["confirmed", "reconciled"]);
const PREPAID_RENT_WINDOW_DAYS = 31;

function asString(value: unknown, max = 500): string | null {
  const next = String(value ?? "").trim().slice(0, max);
  return next || null;
}

function normalizeCurrency(value: unknown): string {
  return String(value || "cad").trim().toLowerCase() || "cad";
}

function normalizeAmountCents(value: unknown): number {
  const next = Number(value);
  if (!Number.isFinite(next) || next < 0) return 0;
  return Math.round(next);
}

function normalizeDate(value: unknown): string | null {
  const raw = asString(value, 120);
  if (!raw) return null;
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) return raw;
  return new Date(parsed).toISOString();
}

function cleanIdPart(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\/\\#?]+/g, "_")
    .replace(/[^a-z0-9_.:-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function rowIdFor(parts: unknown[]): string {
  return cleanIdPart(parts.filter((part) => asString(part, 240)).join(":")) || "obligation:unknown";
}

function normalizeDateToken(value: unknown): string {
  const raw = asString(value, 120);
  if (!raw) return "none";
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) return cleanIdPart(raw) || "none";
  return new Date(parsed).toISOString().slice(0, 10);
}

export function buildPaymentObligationCreditAllocationKey(row: PaymentObligationLedgerRow): string {
  const leaseId = cleanIdPart(row.leaseId) || "lease_unknown";
  const expectedAmountCents = normalizeAmountCents(row.expectedAmountCents);
  const paymentIntentId = cleanIdPart(row.paymentIntentId);
  if (paymentIntentId) return `lease_credit_obligation:${leaseId}:payment_intent:${paymentIntentId}`;
  const rentPaymentId = cleanIdPart(row.rentPaymentId);
  if (rentPaymentId) return `lease_credit_obligation:${leaseId}:rent_payment:${rentPaymentId}`;
  const paymentDocumentId = cleanIdPart(row.paymentDocumentId);
  if (paymentDocumentId) return `lease_credit_obligation:${leaseId}:payment_document:${paymentDocumentId}`;
  return [
    "lease_credit_obligation",
    leaseId,
    "derived",
    normalizeDateToken(row.dueDate),
    normalizeDateToken(row.periodStart),
    normalizeDateToken(row.periodEnd),
    String(expectedAmountCents),
  ].join(":");
}

function rowRawOutstandingAmountCents(row: PaymentObligationLedgerRow): number {
  return Math.max(0, normalizeAmountCents(row.expectedAmountCents) - normalizeAmountCents(row.paidAmountCents));
}

export function applyCreditAllocationsToPaymentObligationRows(
  rows: PaymentObligationLedgerRow[],
  allocationRecords?: PaymentObligationCreditAllocationInput[] | null
): PaymentObligationLedgerRow[] {
  const activeRecords = (allocationRecords || []).filter((record) => {
    return String(record?.status || "").trim() === "active" && normalizeAmountCents(record?.allocationAmountCents) > 0;
  });
  if (activeRecords.length === 0) {
    return rows.map((row) => {
      const outstandingAmountCents = rowRawOutstandingAmountCents(row);
      return {
        ...row,
        allocatedFromCreditCents: 0,
        outstandingAfterAllocationCents: outstandingAmountCents,
        allocationStatus: "none",
        activeAllocationIds: [],
        allocationAdjustedFinancialSignal: null,
        allocationDisplayReason: null,
      };
    });
  }

  const recordsByObligationKey = new Map<string, PaymentObligationCreditAllocationInput[]>();
  const recordsByObligationRowId = new Map<string, PaymentObligationCreditAllocationInput[]>();
  for (const record of activeRecords) {
    const obligationKey = asString(record.obligationKey, 500);
    if (obligationKey) {
      const group = recordsByObligationKey.get(obligationKey) || [];
      group.push(record);
      recordsByObligationKey.set(obligationKey, group);
    }
    const obligationRowId = asString(record.obligationRowId, 240);
    if (obligationRowId) {
      const group = recordsByObligationRowId.get(obligationRowId) || [];
      group.push(record);
      recordsByObligationRowId.set(obligationRowId, group);
    }
  }

  return rows.map((row) => {
    const obligationKey = buildPaymentObligationCreditAllocationKey(row);
    const matchingRecords = recordsByObligationKey.get(obligationKey) || recordsByObligationRowId.get(row.rowId) || [];
    const rawOutstandingAmountCents = rowRawOutstandingAmountCents(row);
    const activeAllocationAmountCents = matchingRecords.reduce(
      (sum, record) => sum + normalizeAmountCents(record.allocationAmountCents),
      0
    );
    const allocatedFromCreditCents = Math.min(rawOutstandingAmountCents, activeAllocationAmountCents);
    const outstandingAfterAllocationCents = Math.max(0, rawOutstandingAmountCents - allocatedFromCreditCents);
    const allocationStatus =
      allocatedFromCreditCents <= 0
        ? "none"
        : outstandingAfterAllocationCents === 0
        ? "fully_allocated"
        : "partially_allocated";
    return {
      ...row,
      allocatedFromCreditCents,
      outstandingAfterAllocationCents,
      allocationStatus,
      activeAllocationIds: matchingRecords.map((record) => asString(record.allocationId, 240)).filter(Boolean) as string[],
      allocationAdjustedFinancialSignal:
        allocationStatus === "none"
          ? null
          : allocationStatus === "fully_allocated"
          ? "credit_allocation_recorded"
          : "allocation_review",
      allocationDisplayReason:
        allocationStatus === "none"
          ? null
          : "Existing lease credit covers this rent charge. Historical payment records were not edited.",
      reasons:
        allocationStatus === "none"
          ? row.reasons
          : Array.from(new Set([...row.reasons, `credit_${allocationStatus}`])),
    };
  });
}

function leaseIdOf(lease: PaymentObligationLeaseInput | null | undefined): string | null {
  return asString(lease?.leaseId || lease?.id, 240);
}

function leaseLifecycleAllowsObligation(lease: PaymentObligationLeaseInput): boolean {
  const state = asString(lease.derivedLifecycleState || lease.status, 80);
  if (!state) return true;
  return state === "active" || state === "notice_period" || state === "signed_future";
}

function findReconciliation(
  records: PaymentObligationReconciliationInput[],
  paymentIntentId?: string | null,
  rentPaymentId?: string | null
): PaymentObligationReconciliationInput | null {
  const normalizedPaymentIntentId = asString(paymentIntentId, 240);
  const normalizedRentPaymentId = asString(rentPaymentId, 240);
  return (
    records.find((record) => {
      const recordPaymentIntentId = asString(record.paymentIntentId, 240);
      const recordRentPaymentId = asString(record.rentPaymentId || record.subjectId, 240);
      return Boolean(
        (normalizedPaymentIntentId && recordPaymentIntentId === normalizedPaymentIntentId) ||
          (normalizedRentPaymentId && recordRentPaymentId === normalizedRentPaymentId)
      );
    }) || null
  );
}

function evidenceStatusFor(input: StatusInput): PaymentObligationLedgerRow["evidenceStatus"] {
  const reconciliationStatus = asString(input.reconciliationStatus, 80);
  if (input.requiresManualReview || (reconciliationStatus && REVIEW_RECONCILIATION_STATUSES.has(reconciliationStatus))) {
    return "manual_review_required";
  }
  if (reconciliationStatus === "reconciled") return "reconciled";
  if (reconciliationStatus && FAILED_RECONCILIATION_STATUSES.has(reconciliationStatus)) return "failed";
  if (reconciliationStatus && PENDING_RECONCILIATION_STATUSES.has(reconciliationStatus)) return "pending";
  if (input.hasCanonicalPayment) return "reconciled";
  if (input.rentPaymentStatus && FAILED_RENT_PAYMENT_STATUSES.has(input.rentPaymentStatus)) return "failed";
  if (input.rentPaymentStatus || input.paymentIntentStatus) return "provider_received";
  return "none";
}

function dateOnlyMillis(value: unknown): number | null {
  const raw = asString(value, 120);
  if (!raw) return null;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    return Date.UTC(Number(year), Number(month) - 1, Number(day));
  }
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) return null;
  const date = new Date(parsed);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function dateOnlyParts(value: unknown): { year: number; month: number; day: number } | null {
  const raw = asString(value, 120);
  if (!raw) return null;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    return { year: Number(year), month: Number(month), day: Number(day) };
  }
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) return null;
  const date = new Date(parsed);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function daysInUtcMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function formatDateOnly(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function nextMonth(year: number, month: number): { year: number; month: number } {
  if (month < 12) return { year, month: month + 1 };
  return { year: year + 1, month: 1 };
}

function normalizeDueDay(value: unknown): number | null {
  const day = Number(value);
  if (!Number.isInteger(day) || day < 1 || day > 31) return null;
  return day;
}

function leaseDueDay(lease: PaymentObligationLeaseInput | null | undefined): number {
  return (
    normalizeDueDay(lease?.dueDay) ??
    normalizeDueDay(lease?.rentDueDay) ??
    normalizeDueDay(lease?.paymentDueDay) ??
    normalizeDueDay(lease?.rentDueDayOfMonth) ??
    normalizeDueDay(lease?.rentSchedule?.dueDay) ??
    normalizeDueDay(lease?.rentSchedule?.rentDueDay) ??
    normalizeDueDay(lease?.rentSchedule?.paymentDueDay) ??
    normalizeDueDay(lease?.rentSchedule?.dayOfMonth) ??
    normalizeDueDay(lease?.paymentTerms?.dueDay) ??
    normalizeDueDay(lease?.paymentTerms?.rentDueDay) ??
    normalizeDueDay(lease?.paymentTerms?.paymentDueDay) ??
    normalizeDueDay(lease?.paymentTerms?.dayOfMonth) ??
    1
  );
}

function leaseStartDate(lease: PaymentObligationLeaseInput | null | undefined): string | null {
  return asString(lease?.startDate || lease?.leaseStartDate || lease?.leaseStart, 120);
}

function leaseEndDate(lease: PaymentObligationLeaseInput | null | undefined): string | null {
  return asString(lease?.endDate || lease?.leaseEndDate || lease?.leaseEnd, 120);
}

function deriveLeaseTermDueDate(lease: PaymentObligationLeaseInput | null | undefined, periodStart?: unknown, fallbackDueDate?: unknown): string | null {
  const anchor = dateOnlyParts(periodStart || leaseStartDate(lease) || fallbackDueDate || lease?.dueDate);
  if (!anchor) return null;
  const configuredDueDay = lease ? leaseDueDay(lease) : 1;
  const dueMonth =
    anchor.day > configuredDueDay
      ? nextMonth(anchor.year, anchor.month)
      : { year: anchor.year, month: anchor.month };
  const dueDay = Math.min(configuredDueDay, daysInUtcMonth(dueMonth.year, dueMonth.month));
  return formatDateOnly(dueMonth.year, dueMonth.month, dueDay);
}

function paymentFallsWithinLeaseTerm(payment: PaymentObligationCanonicalPaymentInput, lease: PaymentObligationLeaseInput | null): boolean {
  if (!lease) return false;
  const paymentDate = dateOnlyMillis(payment.effectiveDate || payment.paidAt);
  if (paymentDate === null) return true;
  const start = dateOnlyMillis(leaseStartDate(lease));
  const end = dateOnlyMillis(leaseEndDate(lease));
  if (start !== null && paymentDate < start - PREPAID_RENT_WINDOW_DAYS * 86_400_000) return false;
  if (end !== null && paymentDate > end) return false;
  return true;
}

function canonicalPaymentCanReconcile(payment: PaymentObligationCanonicalPaymentInput): boolean {
  const status = asString(payment.status, 80);
  if (!status) return true;
  return status === "recorded" || status === "paid" || status === "completed" || status === "reconciled";
}

export function derivePaymentObligationStatus(input: StatusInput): {
  obligationStatus: PaymentObligationStatus;
  reasons: string[];
  evidenceStatus: PaymentObligationLedgerRow["evidenceStatus"];
} {
  const reasons: string[] = [];
  const expectedAmountCents = normalizeAmountCents(input.expectedAmountCents);
  const paidAmountCents = normalizeAmountCents(input.paidAmountCents);
  const reconciliationStatus = asString(input.reconciliationStatus, 80);
  const evidenceStatus = evidenceStatusFor(input);

  if (input.requiresManualReview || (reconciliationStatus && REVIEW_RECONCILIATION_STATUSES.has(reconciliationStatus))) {
    reasons.push(input.requiresManualReview ? "reconciliation_requires_manual_review" : `reconciliation_${reconciliationStatus}`);
    return { obligationStatus: "manual_review_required", reasons, evidenceStatus };
  }

  if (expectedAmountCents <= 0) {
    reasons.push("missing_expected_amount");
    return { obligationStatus: "unknown", reasons, evidenceStatus };
  }

  if (input.rentPaymentStatus && FAILED_RENT_PAYMENT_STATUSES.has(input.rentPaymentStatus)) {
    reasons.push(`rent_payment_${input.rentPaymentStatus}`);
    return { obligationStatus: "failed", reasons, evidenceStatus };
  }

  if (input.paymentIntentStatus && FAILED_PAYMENT_INTENT_STATUSES.has(input.paymentIntentStatus)) {
    reasons.push(`payment_intent_${input.paymentIntentStatus}`);
    return { obligationStatus: "failed", reasons, evidenceStatus };
  }

  if (paidAmountCents > 0) {
    if (paidAmountCents === expectedAmountCents) {
      reasons.push("paid_amount_matches_expected");
      return { obligationStatus: "paid", reasons, evidenceStatus };
    }
    if (paidAmountCents < expectedAmountCents) {
      reasons.push("paid_amount_below_expected");
      return { obligationStatus: "underpaid", reasons, evidenceStatus };
    }
    reasons.push("paid_amount_above_expected");
    return { obligationStatus: "overpaid", reasons, evidenceStatus };
  }

  if (input.rentPaymentStatus && PENDING_RENT_PAYMENT_STATUSES.has(input.rentPaymentStatus)) {
    reasons.push(`rent_payment_${input.rentPaymentStatus}`);
    return { obligationStatus: "pending", reasons, evidenceStatus };
  }

  if (input.paymentIntentStatus && PENDING_PAYMENT_INTENT_STATUSES.has(input.paymentIntentStatus)) {
    reasons.push(`payment_intent_${input.paymentIntentStatus}`);
    return { obligationStatus: "pending", reasons, evidenceStatus };
  }

  if (input.paymentIntentStatus && PAID_PAYMENT_INTENT_STATUSES.has(input.paymentIntentStatus)) {
    reasons.push("payment_intent_confirmed_without_paid_rent_payment");
    return { obligationStatus: "manual_review_required", reasons, evidenceStatus: "manual_review_required" };
  }

  if (input.hasPaymentIntent || input.hasLeaseObligation) {
    reasons.push("expected_payment_missing");
    return { obligationStatus: "missing", reasons, evidenceStatus };
  }

  reasons.push("insufficient_obligation_context");
  return { obligationStatus: "unknown", reasons, evidenceStatus };
}

export function buildPaymentObligationLedgerRows(
  input: BuildPaymentObligationLedgerRowsInput
): PaymentObligationLedgerRow[] {
  const leases = input.leases || [];
  const leaseById = new Map(leases.map((lease) => [leaseIdOf(lease), lease]).filter(([id]) => Boolean(id)) as Array<[string, PaymentObligationLeaseInput]>);
  const rentPayments = input.rentPayments || [];
  const canonicalPayments = input.canonicalPayments || [];
  const rentPaymentsByIntent = new Map<string, RentPaymentRecord[]>();
  const rentPaymentById = new Map<string, RentPaymentRecord>();
  const reconciliationRecords = input.reconciliationRecords || [];
  const rows: PaymentObligationLedgerRow[] = [];
  const seenLeaseIds = new Set<string>();
  const seenRentPaymentIds = new Set<string>();

  for (const rentPayment of rentPayments) {
    const rentPaymentId = asString(rentPayment.id, 240);
    if (rentPaymentId) rentPaymentById.set(rentPaymentId, rentPayment);
    const paymentIntentId = asString(rentPayment.paymentIntentId, 240);
    if (paymentIntentId) {
      const group = rentPaymentsByIntent.get(paymentIntentId) || [];
      group.push(rentPayment);
      rentPaymentsByIntent.set(paymentIntentId, group);
    }
  }

  const canonicalPaymentsByLease = new Map<string, PaymentObligationCanonicalPaymentInput[]>();
  for (const payment of canonicalPayments) {
    const leaseId = asString(payment.leaseId, 240);
    if (!leaseId || !canonicalPaymentCanReconcile(payment)) continue;
    const group = canonicalPaymentsByLease.get(leaseId) || [];
    group.push(payment);
    canonicalPaymentsByLease.set(leaseId, group);
  }

  for (const intent of input.paymentIntents || []) {
    const lease = leaseById.get(asString(intent.leaseId, 240) || "") || null;
    const linkedRentPayments = [
      ...((intent.paymentIntentId && rentPaymentsByIntent.get(intent.paymentIntentId)) || []),
      ...(intent.rentPaymentId && rentPaymentById.has(intent.rentPaymentId) ? [rentPaymentById.get(intent.rentPaymentId)!] : []),
    ].filter((record, index, records) => records.findIndex((item) => item.id === record.id) === index);
    for (const record of linkedRentPayments) seenRentPaymentIds.add(record.id);
    if (intent.leaseId) seenLeaseIds.add(intent.leaseId);

    const paidAmountCents = linkedRentPayments
      .filter((record) => record.status === "paid")
      .reduce((sum, record) => sum + normalizeAmountCents(record.amountCents), 0);
    const latestRentPayment = linkedRentPayments[0] || (intent.rentPaymentId ? rentPaymentById.get(intent.rentPaymentId) || null : null);
    const reconciliation = findReconciliation(reconciliationRecords, intent.paymentIntentId, latestRentPayment?.id || intent.rentPaymentId || null);
    const status = derivePaymentObligationStatus({
      expectedAmountCents: intent.amountCents,
      paidAmountCents,
      paymentIntentStatus: intent.status,
      rentPaymentStatus: latestRentPayment?.status || null,
      reconciliationStatus: reconciliation?.reconciliationStatus || null,
      requiresManualReview: intent.requiresReview || reconciliation?.requiresManualReview,
      hasPaymentEvidence: linkedRentPayments.length > 0,
      hasPaymentIntent: true,
      hasRentPayment: linkedRentPayments.length > 0,
      hasLeaseObligation: Boolean(lease),
    });

    rows.push({
      rowId: rowIdFor(["payment_intent", intent.paymentIntentId]),
      leaseId: asString(intent.leaseId || leaseIdOf(lease), 240) || "unknown",
      paymentIntentId: intent.paymentIntentId,
      rentPaymentId: latestRentPayment?.id || intent.rentPaymentId || null,
      paymentDocumentId: null,
      propertyId: intent.propertyId || lease?.propertyId || null,
      unitId: intent.unitId || lease?.unitId || null,
      tenantId: intent.tenantId || lease?.tenantId || lease?.primaryTenantId || null,
      periodStart: normalizeDate(intent.periodStart || leaseStartDate(lease)),
      periodEnd: normalizeDate(intent.periodEnd || leaseEndDate(lease)),
      dueDate: deriveLeaseTermDueDate(lease, intent.periodStart || leaseStartDate(lease), intent.dueDate || lease?.dueDate),
      expectedAmountCents: normalizeAmountCents(intent.amountCents),
      paidAmountCents,
      currency: normalizeCurrency(intent.currency || lease?.currency),
      obligationStatus: status.obligationStatus,
      paymentIntentStatus: intent.status,
      rentPaymentStatus: latestRentPayment?.status || null,
      reconciliationStatus: (asString(reconciliation?.reconciliationStatus, 80) as PaymentReconciliationStatus | null) || null,
      evidenceStatus: status.evidenceStatus,
      source: reconciliation ? "reconciliation" : "payment_intent",
      reasons: [...status.reasons, ...(reconciliation?.reasons || [])].filter(Boolean),
    });
  }

  for (const rentPayment of rentPayments) {
    if (seenRentPaymentIds.has(rentPayment.id)) continue;
    if (rentPayment.leaseId) seenLeaseIds.add(rentPayment.leaseId);
    const lease = leaseById.get(rentPayment.leaseId) || null;
    const reconciliation = findReconciliation(reconciliationRecords, rentPayment.paymentIntentId || null, rentPayment.id);
    const paidAmountCents = rentPayment.status === "paid" ? normalizeAmountCents(rentPayment.amountCents) : 0;
    const status = derivePaymentObligationStatus({
      expectedAmountCents: rentPayment.amountCents,
      paidAmountCents,
      rentPaymentStatus: rentPayment.status,
      reconciliationStatus: reconciliation?.reconciliationStatus || null,
      requiresManualReview: reconciliation?.requiresManualReview,
      hasPaymentEvidence: true,
      hasRentPayment: true,
      hasLeaseObligation: Boolean(lease),
    });
    rows.push({
      rowId: rowIdFor(["rent_payment", rentPayment.id]),
      leaseId: rentPayment.leaseId,
      paymentIntentId: rentPayment.paymentIntentId || null,
      rentPaymentId: rentPayment.id,
      paymentDocumentId: null,
      propertyId: rentPayment.propertyId || lease?.propertyId || null,
      unitId: rentPayment.unitId || lease?.unitId || null,
      tenantId: rentPayment.tenantId || lease?.tenantId || lease?.primaryTenantId || null,
      periodStart: normalizeDate(leaseStartDate(lease)),
      periodEnd: normalizeDate(leaseEndDate(lease)),
      dueDate: deriveLeaseTermDueDate(lease, leaseStartDate(lease), lease?.dueDate),
      expectedAmountCents: normalizeAmountCents(rentPayment.amountCents),
      paidAmountCents,
      currency: normalizeCurrency(rentPayment.currency || lease?.currency),
      obligationStatus: status.obligationStatus,
      paymentIntentStatus: null,
      rentPaymentStatus: rentPayment.status,
      reconciliationStatus: (asString(reconciliation?.reconciliationStatus, 80) as PaymentReconciliationStatus | null) || null,
      evidenceStatus: status.evidenceStatus,
      source: reconciliation ? "reconciliation" : "rent_payment",
      reasons: [...status.reasons, ...(reconciliation?.reasons || [])].filter(Boolean),
    });
  }

  for (const [leaseId, payments] of canonicalPaymentsByLease.entries()) {
    const lease = leaseById.get(leaseId) || null;
    if (!lease || seenLeaseIds.has(leaseId) || !leaseLifecycleAllowsObligation(lease)) continue;
    seenLeaseIds.add(leaseId);
    const inWindowPayments = payments.filter((payment) => paymentFallsWithinLeaseTerm(payment, lease));
    const outOfWindowPayments = payments.filter((payment) => !paymentFallsWithinLeaseTerm(payment, lease));
    const paidAmountCents = inWindowPayments.reduce((sum, payment) => sum + normalizeAmountCents(payment.amountCents), 0);
    const expectedAmountCents = normalizeAmountCents(lease.amountCents ?? lease.monthlyRent);
    const status = derivePaymentObligationStatus({
      expectedAmountCents,
      paidAmountCents,
      hasPaymentEvidence: inWindowPayments.length > 0,
      hasCanonicalPayment: inWindowPayments.length > 0,
      hasLeaseObligation: true,
      requiresManualReview: outOfWindowPayments.length > 0 && inWindowPayments.length === 0,
    });
    rows.push({
      rowId: rowIdFor(["canonical_payment", leaseId, inWindowPayments.map((payment) => payment.id || payment.paymentDocumentId).join("_")]),
      leaseId,
      paymentIntentId: null,
      rentPaymentId: null,
      paymentDocumentId:
        inWindowPayments.length === 1
          ? asString(inWindowPayments[0].paymentDocumentId || inWindowPayments[0].id, 240)
          : null,
      propertyId: inWindowPayments[0]?.propertyId || lease.propertyId || null,
      unitId: inWindowPayments[0]?.unitId || lease.unitId || null,
      tenantId: inWindowPayments[0]?.tenantId || lease.tenantId || lease.primaryTenantId || null,
      periodStart: normalizeDate(leaseStartDate(lease)),
      periodEnd: normalizeDate(leaseEndDate(lease)),
      dueDate: deriveLeaseTermDueDate(lease, leaseStartDate(lease), lease.dueDate),
      expectedAmountCents,
      paidAmountCents,
      currency: normalizeCurrency(inWindowPayments[0]?.currency || lease.currency),
      obligationStatus: status.obligationStatus,
      paymentIntentStatus: null,
      rentPaymentStatus: null,
      reconciliationStatus: null,
      evidenceStatus: status.evidenceStatus,
      source: "canonical_payment",
      reasons: [
        ...status.reasons,
        inWindowPayments.length > 0 ? "canonical_payment_recorded" : null,
        outOfWindowPayments.length > 0 ? "canonical_payment_outside_lease_term" : null,
      ].filter(Boolean) as string[],
    });
  }

  for (const lease of leases) {
    const leaseId = leaseIdOf(lease);
    if (!leaseId || seenLeaseIds.has(leaseId) || !leaseLifecycleAllowsObligation(lease)) continue;
    const expectedAmountCents = normalizeAmountCents(lease.amountCents ?? lease.monthlyRent);
    const status = derivePaymentObligationStatus({
      expectedAmountCents,
      paidAmountCents: 0,
      hasLeaseObligation: true,
    });
    rows.push({
      rowId: rowIdFor(["lease_lifecycle", leaseId]),
      leaseId,
      paymentIntentId: null,
      rentPaymentId: null,
      propertyId: lease.propertyId || null,
      unitId: lease.unitId || null,
      tenantId: lease.tenantId || lease.primaryTenantId || null,
      periodStart: normalizeDate(leaseStartDate(lease)),
      periodEnd: normalizeDate(leaseEndDate(lease)),
      dueDate: deriveLeaseTermDueDate(lease, leaseStartDate(lease), lease.dueDate),
      expectedAmountCents,
      paidAmountCents: 0,
      currency: normalizeCurrency(lease.currency),
      obligationStatus: status.obligationStatus,
      paymentIntentStatus: null,
      rentPaymentStatus: null,
      reconciliationStatus: null,
      evidenceStatus: status.evidenceStatus,
      source: "lease_lifecycle",
      reasons: status.reasons,
    });
  }

  const sortedRows = rows.sort((a, b) => {
    const dueDiff = String(a.dueDate || a.periodStart || "").localeCompare(String(b.dueDate || b.periodStart || ""));
    if (dueDiff !== 0) return dueDiff;
    return a.rowId.localeCompare(b.rowId);
  });

  return applyCreditAllocationsToPaymentObligationRows(sortedRows, input.creditAllocationRecords);
}

export function summarizePaymentObligationLedger(
  rows: PaymentObligationLedgerRow[],
  options: SummarizePaymentObligationLedgerOptions = {}
): PaymentObligationLedgerSummary {
  const statusCounts = {
    expected: 0,
    pending: 0,
    paid: 0,
    underpaid: 0,
    overpaid: 0,
    failed: 0,
    missing: 0,
    manual_review_required: 0,
    unknown: 0,
  } satisfies Record<PaymentObligationStatus, number>;

  let expectedAmountCents = 0;
  let paidAmountCents = 0;
  let totalAllocatedCreditCents = 0;
  let totalOutstandingAfterAllocationCents = 0;
  for (const row of rows || []) {
    statusCounts[row.obligationStatus] += 1;
    expectedAmountCents += normalizeAmountCents(row.expectedAmountCents);
    paidAmountCents += normalizeAmountCents(row.paidAmountCents);
    totalAllocatedCreditCents += normalizeAmountCents(row.allocatedFromCreditCents);
    totalOutstandingAfterAllocationCents += Math.max(0, normalizeAmountCents(row.outstandingAfterAllocationCents ?? rowRawOutstandingAmountCents(row)));
  }
  const aggregateBalance = Number(options.aggregateBalanceCents);
  const availableCreditAfterAllocationCents = Number.isFinite(aggregateBalance)
    ? Math.max(0, Math.max(0, -Math.round(aggregateBalance)) - totalAllocatedCreditCents)
    : null;

  return {
    totalRows: rows.length,
    expectedAmountCents,
    paidAmountCents,
    outstandingAmountCents: Math.max(0, expectedAmountCents - paidAmountCents),
    totalAllocatedCreditCents,
    totalOutstandingAfterAllocationCents,
    allocationAdjustedOutstandingCents: totalOutstandingAfterAllocationCents,
    availableCreditAfterAllocationCents,
    statusCounts,
    manualReviewCount: statusCounts.manual_review_required,
  };
}
