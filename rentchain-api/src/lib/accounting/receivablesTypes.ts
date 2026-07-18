export const RECEIVABLE_TRANSACTION_TYPES = [
  "scheduled_rent_charge",
  "deposit_charge",
  "one_time_charge",
  "credit",
  "adjustment",
  "payment_applied",
  "payment_reversal",
  "write_off",
  "nsf_fee",
] as const;

export type ReceivableTransactionType = (typeof RECEIVABLE_TRANSACTION_TYPES)[number];
export type ReceivableAdjustmentDirection = "increase" | "decrease";
export type ReceivableFindingSeverity = "error" | "review" | "info";

export type ReceivableFinding = {
  code: string;
  severity: ReceivableFindingSeverity;
  transactionId?: string | null;
  field?: string | null;
};

export type ReceivableTransactionMetadata = {
  policyKey?: string;
  scheduleOccurrenceKey?: string;
  adjustmentDirection?: ReceivableAdjustmentDirection;
};

export type ReceivableTransaction = {
  transactionId: string;
  leaseId: string;
  propertyId: string;
  unitId: string | null;
  responsibilityId: string | null;
  tenantId: string | null;
  type: ReceivableTransactionType;
  amountCents: number;
  currency: "cad";
  effectiveDate: string;
  dueDate: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  sourceRef: string | null;
  sourceVersion: string | null;
  reversesTransactionId: string | null;
  appliesToTransactionId: string | null;
  metadata: ReceivableTransactionMetadata;
};

export type NormalizeReceivableTransactionResult = {
  transaction: ReceivableTransaction | null;
  findings: ReceivableFinding[];
};

const TYPE_SET = new Set<string>(RECEIVABLE_TRANSACTION_TYPES);
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function cleanAccountingString(value: unknown, max = 300): string | null {
  const next = typeof value === "string" ? value.trim().slice(0, max) : "";
  return next || null;
}

export function parseDateOnly(value: unknown): { value: string; epochDay: number; year: number; month: number; day: number } | null {
  const raw = cleanAccountingString(value, 10);
  const match = raw ? DATE_ONLY_PATTERN.exec(raw) : null;
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const epochMillis = Date.UTC(year, month - 1, day);
  const date = new Date(epochMillis);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return { value: raw!, epochDay: Math.floor(epochMillis / 86_400_000), year, month, day };
}

export function formatDateOnly(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function daysInUtcMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function addUtcMonths(year: number, month: number, count = 1): { year: number; month: number } {
  const date = new Date(Date.UTC(year, month - 1 + count, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

function optionalDate(value: unknown, field: string, transactionId: string | null, findings: ReceivableFinding[]) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = parseDateOnly(value);
  if (!parsed) findings.push({ code: "invalid_date_only", severity: "error", transactionId, field });
  return parsed?.value || null;
}

export function normalizeReceivableTransaction(input: unknown): NormalizeReceivableTransactionResult {
  const source = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const transactionId = cleanAccountingString(source.transactionId);
  const findings: ReceivableFinding[] = [];
  const requiredString = (field: string) => {
    const value = cleanAccountingString(source[field]);
    if (!value) findings.push({ code: "required_field_missing", severity: "error", transactionId, field });
    return value || "";
  };

  const leaseId = requiredString("leaseId");
  const propertyId = requiredString("propertyId");
  if (!transactionId) findings.push({ code: "required_field_missing", severity: "error", field: "transactionId" });

  const typeValue = cleanAccountingString(source.type, 80);
  const type = typeValue && TYPE_SET.has(typeValue) ? (typeValue as ReceivableTransactionType) : null;
  if (!type) findings.push({ code: "unsupported_transaction_type", severity: "error", transactionId, field: "type" });

  const amountCents = source.amountCents;
  if (!Number.isSafeInteger(amountCents) || Number(amountCents) <= 0) {
    findings.push({ code: "invalid_amount_cents", severity: "error", transactionId, field: "amountCents" });
  }

  const currencyValue = cleanAccountingString(source.currency, 8)?.toLowerCase();
  if (currencyValue !== "cad") {
    findings.push({ code: "unsupported_currency", severity: "error", transactionId, field: "currency" });
  }

  const effectiveDate = optionalDate(source.effectiveDate, "effectiveDate", transactionId, findings);
  if (!effectiveDate) {
    if (!findings.some((finding) => finding.field === "effectiveDate")) {
      findings.push({ code: "required_field_missing", severity: "error", transactionId, field: "effectiveDate" });
    }
  }
  const dueDate = optionalDate(source.dueDate, "dueDate", transactionId, findings);
  const periodStart = optionalDate(source.periodStart, "periodStart", transactionId, findings);
  const periodEnd = optionalDate(source.periodEnd, "periodEnd", transactionId, findings);
  if (periodStart && periodEnd && parseDateOnly(periodEnd)!.epochDay < parseDateOnly(periodStart)!.epochDay) {
    findings.push({ code: "invalid_period_range", severity: "error", transactionId, field: "periodEnd" });
  }

  const metadataSource = source.metadata && typeof source.metadata === "object"
    ? (source.metadata as Record<string, unknown>)
    : {};
  const adjustmentDirection = cleanAccountingString(metadataSource.adjustmentDirection, 20);
  if (type === "adjustment" && adjustmentDirection !== "increase" && adjustmentDirection !== "decrease") {
    findings.push({ code: "adjustment_direction_required", severity: "error", transactionId, field: "metadata.adjustmentDirection" });
  }
  if (type === "payment_reversal" && !cleanAccountingString(source.reversesTransactionId)) {
    findings.push({ code: "reversal_target_required", severity: "error", transactionId, field: "reversesTransactionId" });
  }
  if (type === "nsf_fee") {
    findings.push({ code: "nsf_fee_policy_not_enabled", severity: "review", transactionId, field: "type" });
  }

  const hasErrors = findings.some((finding) => finding.severity === "error");
  if (hasErrors || !type || !transactionId || !effectiveDate || currencyValue !== "cad") {
    return { transaction: null, findings };
  }

  return {
    transaction: {
      transactionId,
      leaseId,
      propertyId,
      unitId: cleanAccountingString(source.unitId),
      responsibilityId: cleanAccountingString(source.responsibilityId),
      tenantId: cleanAccountingString(source.tenantId),
      type,
      amountCents: Number(amountCents),
      currency: "cad",
      effectiveDate,
      dueDate,
      periodStart,
      periodEnd,
      sourceRef: cleanAccountingString(source.sourceRef),
      sourceVersion: cleanAccountingString(source.sourceVersion),
      reversesTransactionId: cleanAccountingString(source.reversesTransactionId),
      appliesToTransactionId: cleanAccountingString(source.appliesToTransactionId),
      metadata: {
        ...(cleanAccountingString(metadataSource.policyKey) ? { policyKey: cleanAccountingString(metadataSource.policyKey)! } : {}),
        ...(cleanAccountingString(metadataSource.scheduleOccurrenceKey)
          ? { scheduleOccurrenceKey: cleanAccountingString(metadataSource.scheduleOccurrenceKey)! }
          : {}),
        ...(adjustmentDirection === "increase" || adjustmentDirection === "decrease"
          ? { adjustmentDirection }
          : {}),
      },
    },
    findings,
  };
}

export function sortReceivableFindings(findings: readonly ReceivableFinding[]): ReceivableFinding[] {
  return [...findings].sort((a, b) =>
    [a.code, a.transactionId || "", a.field || "", a.severity]
      .join(":")
      .localeCompare([b.code, b.transactionId || "", b.field || "", b.severity].join(":"))
  );
}
