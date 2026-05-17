import type { PaymentObligationLedgerRow, PaymentObligationStatus } from "./paymentObligationLedger";

export type DelinquencySignalType =
  | "rent_due"
  | "overdue"
  | "partially_paid"
  | "failed_payment"
  | "missing_payment"
  | "manual_review_required";

export type DelinquencySeverity = "info" | "warning" | "critical";

export type DelinquencySignal = {
  signalId: string;
  leaseId: string;
  paymentIntentId?: string | null;
  rentPaymentId?: string | null;
  propertyId: string | null;
  unitId?: string | null;
  tenantId?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  dueDate?: string | null;
  expectedAmountCents: number;
  paidAmountCents: number;
  outstandingAmountCents: number;
  signalType: DelinquencySignalType;
  severity: DelinquencySeverity;
  detectedAt: string;
  reasons: string[];
};

export type DelinquencySummary = {
  totalSignals: number;
  overdueCount: number;
  partiallyPaidCount: number;
  failedCount: number;
  missingCount: number;
  manualReviewCount: number;
  totalOutstandingCents: number;
};

function asString(value: unknown, max = 500): string | null {
  const next = String(value ?? "").trim().slice(0, max);
  return next || null;
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
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

function dayNumber(value: unknown): number | null {
  const date = normalizeDate(value);
  if (!date) return null;
  const parsed = new Date(date);
  return Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
}

function todayIso(value: unknown): string {
  return normalizeDate(value) || new Date().toISOString();
}

function cleanIdPart(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\/\\#?]+/g, "_")
    .replace(/[^a-z0-9_.:-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function buildSignalId(row: PaymentObligationLedgerRow, signalType: DelinquencySignalType): string {
  const subject = row.paymentIntentId || row.rentPaymentId || row.rowId || row.leaseId || "unknown";
  return cleanIdPart(["delinquency", signalType, subject].join(":")) || "delinquency:unknown";
}

function obligationKey(signal: DelinquencySignal): string {
  return (
    cleanIdPart(
      [
        signal.paymentIntentId || "",
        signal.rentPaymentId || "",
        signal.leaseId,
        signal.periodStart || "",
        signal.periodEnd || "",
        signal.dueDate || "",
        signal.expectedAmountCents,
      ].join(":")
    ) || signal.signalId
  );
}

function isDueTodayOrFuture(dueDate: unknown, today: unknown): boolean {
  const dueDay = dayNumber(dueDate);
  const todayDay = dayNumber(today);
  return dueDay != null && todayDay != null && todayDay <= dueDay;
}

function isPastDue(dueDate: unknown, today: unknown): boolean {
  const dueDay = dayNumber(dueDate);
  const todayDay = dayNumber(today);
  return dueDay != null && todayDay != null && todayDay > dueDay;
}

function severityFor(signalType: DelinquencySignalType): DelinquencySeverity {
  switch (signalType) {
    case "rent_due":
      return "info";
    case "partially_paid":
    case "missing_payment":
    case "manual_review_required":
      return "warning";
    case "overdue":
    case "failed_payment":
      return "critical";
    default:
      return "warning";
  }
}

function makeSignal(
  row: PaymentObligationLedgerRow,
  signalType: DelinquencySignalType,
  detectedAt: string,
  reasons: string[]
): DelinquencySignal {
  const expectedAmountCents = normalizeAmountCents(row.expectedAmountCents);
  const paidAmountCents = normalizeAmountCents(row.paidAmountCents);
  const outstandingAmountCents = Math.max(0, expectedAmountCents - paidAmountCents);
  return {
    signalId: buildSignalId(row, signalType),
    leaseId: asString(row.leaseId, 240) || "unknown",
    paymentIntentId: asString(row.paymentIntentId, 240),
    rentPaymentId: asString(row.rentPaymentId, 240),
    propertyId: asString(row.propertyId, 240),
    unitId: asString(row.unitId, 240),
    tenantId: asString(row.tenantId, 240),
    periodStart: normalizeDate(row.periodStart),
    periodEnd: normalizeDate(row.periodEnd),
    dueDate: normalizeDate(row.dueDate),
    expectedAmountCents,
    paidAmountCents,
    outstandingAmountCents,
    signalType,
    severity: severityFor(signalType),
    detectedAt,
    reasons,
  };
}

function deriveSignalTypes(
  row: PaymentObligationLedgerRow,
  today: unknown
): Array<{ signalType: DelinquencySignalType; reasons: string[] }> {
  const status = String(row.obligationStatus || "unknown").trim() as PaymentObligationStatus;
  const expectedAmountCents = normalizeAmountCents(row.expectedAmountCents);
  const paidAmountCents = normalizeAmountCents(row.paidAmountCents);
  const outstandingAmountCents = Math.max(0, expectedAmountCents - paidAmountCents);
  const pastDue = isPastDue(row.dueDate, today);
  const dueTodayOrFuture = isDueTodayOrFuture(row.dueDate, today);
  const hasRentPayment = Boolean(asString(row.rentPaymentId, 240));
  const signals: Array<{ signalType: DelinquencySignalType; reasons: string[] }> = [];

  if (status === "manual_review_required" || status === "unknown") {
    return [
      {
        signalType: "manual_review_required",
        reasons: status === "unknown" ? ["obligation_status_unknown"] : ["obligation_requires_manual_review"],
      },
    ];
  }

  if (status === "failed") {
    return [{ signalType: "failed_payment", reasons: ["obligation_payment_failed"] }];
  }

  if (status === "underpaid") {
    return [{ signalType: "partially_paid", reasons: ["obligation_partially_paid"] }];
  }

  if ((status === "missing" || status === "pending") && pastDue && outstandingAmountCents > 0) {
    signals.push({ signalType: "overdue", reasons: [`obligation_${status}_after_due_date`] });
  }

  if (!hasRentPayment && pastDue && outstandingAmountCents > 0) {
    signals.push({ signalType: "missing_payment", reasons: ["missing_rent_payment_after_due_date"] });
  }

  if ((status === "expected" || status === "pending") && dueTodayOrFuture) {
    signals.push({ signalType: "rent_due", reasons: [`obligation_${status}_not_past_due`] });
  }

  return signals;
}

export function deriveDelinquencySignals(
  obligationRows: PaymentObligationLedgerRow[] | null | undefined,
  today: unknown = new Date()
): DelinquencySignal[] {
  const detectedAt = todayIso(today);
  return (obligationRows || [])
    .flatMap((row) =>
      deriveSignalTypes(row, today).map((derived) => makeSignal(row, derived.signalType, detectedAt, derived.reasons))
    );
}

export function summarizeDelinquencySignals(signals: DelinquencySignal[] | null | undefined): DelinquencySummary {
  const rows = signals || [];
  const outstandingByObligation = new Map<string, number>();
  for (const signal of rows) {
    const key = obligationKey(signal);
    outstandingByObligation.set(key, Math.max(outstandingByObligation.get(key) || 0, normalizeAmountCents(signal.outstandingAmountCents)));
  }
  return {
    totalSignals: rows.length,
    overdueCount: rows.filter((signal) => signal.signalType === "overdue").length,
    partiallyPaidCount: rows.filter((signal) => signal.signalType === "partially_paid").length,
    failedCount: rows.filter((signal) => signal.signalType === "failed_payment").length,
    missingCount: rows.filter((signal) => signal.signalType === "missing_payment").length,
    manualReviewCount: rows.filter((signal) => signal.signalType === "manual_review_required").length,
    totalOutstandingCents: Array.from(outstandingByObligation.values()).reduce((sum, amount) => sum + amount, 0),
  };
}
