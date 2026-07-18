import {
  addUtcMonths,
  cleanAccountingString,
  daysInUtcMonth,
  formatDateOnly,
  parseDateOnly,
  sortReceivableFindings,
  type ReceivableFinding,
  type ReceivableTransactionType,
} from "./receivablesTypes";
import { buildReceivablesFingerprint } from "./receivablesFingerprint";

export const MAX_CHARGE_SCHEDULE_OCCURRENCES = 120;

export type LeaseChargeScheduleInput = {
  leaseId?: unknown;
  propertyId?: unknown;
  unitId?: unknown;
  responsibilityId?: unknown;
  tenantId?: unknown;
  sourceLeaseVersion?: unknown;
  leaseStartDate?: unknown;
  leaseEndDate?: unknown;
  monthlyRentCents?: unknown;
  dueDay?: unknown;
  currency?: unknown;
  billingFrequency?: unknown;
  depositAmountCents?: unknown;
  asOfDate?: unknown;
  previewThroughDate?: unknown;
};

export type NormalizedLeaseChargeScheduleInput = {
  leaseId: string;
  propertyId: string;
  unitId: string | null;
  responsibilityId: string | null;
  tenantId: string | null;
  sourceLeaseVersion: string;
  leaseStartDate: string;
  leaseEndDate: string | null;
  monthlyRentCents: number;
  dueDay: number;
  currency: "cad";
  billingFrequency: "monthly";
  depositAmountCents: number | null;
  asOfDate: string;
  previewThroughDate: string;
};

export type LeaseChargeOccurrence = {
  occurrenceKey: string;
  type: Extract<ReceivableTransactionType, "scheduled_rent_charge" | "deposit_charge">;
  amountCents: number;
  currency: "cad";
  dueDate: string;
  periodStart: string;
  periodEnd: string;
  sourceLeaseVersion: string;
  policyReviewRequired: boolean;
};

export type LeaseChargeSchedulePreview = {
  allowed: boolean;
  normalizedInput: NormalizedLeaseChargeScheduleInput | null;
  occurrences: LeaseChargeOccurrence[];
  totals: {
    scheduledRentCents: number;
    depositChargeCents: number;
    occurrenceCount: number;
  };
  findings: ReceivableFinding[];
  previewFingerprint: string;
};

function requiredString(input: LeaseChargeScheduleInput, field: keyof LeaseChargeScheduleInput, findings: ReceivableFinding[]) {
  const value = cleanAccountingString(input[field]);
  if (!value) findings.push({ code: "required_field_missing", severity: "error", field: String(field) });
  return value;
}

function occurrenceKey(input: NormalizedLeaseChargeScheduleInput, occurrence: Omit<LeaseChargeOccurrence, "occurrenceKey">) {
  return [
    "receivable_charge",
    input.leaseId,
    input.responsibilityId || "lease_level",
    input.sourceLeaseVersion,
    occurrence.type,
    occurrence.dueDate,
    occurrence.periodStart,
    occurrence.periodEnd,
    occurrence.amountCents,
    occurrence.currency,
  ].join(":");
}

function emptyPreview(findings: ReceivableFinding[]): LeaseChargeSchedulePreview {
  const sorted = sortReceivableFindings(findings);
  return {
    allowed: false,
    normalizedInput: null,
    occurrences: [],
    totals: { scheduledRentCents: 0, depositChargeCents: 0, occurrenceCount: 0 },
    findings: sorted,
    previewFingerprint: buildReceivablesFingerprint({ schemaVersion: "lease_charge_schedule_preview_v1", findings: sorted.map((f) => f.code) }),
  };
}

export function buildLeaseChargeSchedulePreview(input: LeaseChargeScheduleInput): LeaseChargeSchedulePreview {
  const findings: ReceivableFinding[] = [];
  const leaseId = requiredString(input, "leaseId", findings);
  const propertyId = requiredString(input, "propertyId", findings);
  const sourceLeaseVersion = requiredString(input, "sourceLeaseVersion", findings);
  const start = parseDateOnly(input.leaseStartDate);
  const end = input.leaseEndDate === null || input.leaseEndDate === undefined || input.leaseEndDate === ""
    ? null
    : parseDateOnly(input.leaseEndDate);
  const asOf = parseDateOnly(input.asOfDate);
  const through = parseDateOnly(input.previewThroughDate);
  if (!start) findings.push({ code: "invalid_date_only", severity: "error", field: "leaseStartDate" });
  if (input.leaseEndDate !== null && input.leaseEndDate !== undefined && input.leaseEndDate !== "" && !end) {
    findings.push({ code: "invalid_date_only", severity: "error", field: "leaseEndDate" });
  }
  if (!asOf) findings.push({ code: "invalid_date_only", severity: "error", field: "asOfDate" });
  if (!through) findings.push({ code: "invalid_date_only", severity: "error", field: "previewThroughDate" });
  if (start && end && end.epochDay < start.epochDay) findings.push({ code: "lease_end_before_start", severity: "error", field: "leaseEndDate" });
  if (start && through && through.epochDay < start.epochDay) findings.push({ code: "preview_horizon_before_lease", severity: "error", field: "previewThroughDate" });

  const monthlyRentCents = input.monthlyRentCents;
  if (!Number.isSafeInteger(monthlyRentCents) || Number(monthlyRentCents) <= 0) {
    findings.push({ code: "invalid_monthly_rent_cents", severity: "error", field: "monthlyRentCents" });
  }
  const dueDay = input.dueDay;
  if (!Number.isInteger(dueDay) || Number(dueDay) < 1 || Number(dueDay) > 31) {
    findings.push({ code: "invalid_due_day", severity: "error", field: "dueDay" });
  }
  const currency = cleanAccountingString(input.currency, 8)?.toLowerCase();
  if (currency !== "cad") findings.push({ code: "unsupported_currency", severity: "error", field: "currency" });
  const billingFrequency = cleanAccountingString(input.billingFrequency, 40)?.toLowerCase();
  if (billingFrequency !== "monthly") findings.push({ code: "unsupported_billing_frequency", severity: "error", field: "billingFrequency" });

  let depositAmountCents: number | null = null;
  if (input.depositAmountCents !== null && input.depositAmountCents !== undefined) {
    if (!Number.isSafeInteger(input.depositAmountCents) || Number(input.depositAmountCents) < 0) {
      findings.push({ code: "invalid_deposit_amount_cents", severity: "error", field: "depositAmountCents" });
    } else if (Number(input.depositAmountCents) > 0) {
      depositAmountCents = Number(input.depositAmountCents);
    }
  }
  const responsibilityId = cleanAccountingString(input.responsibilityId);
  if (!responsibilityId) findings.push({ code: "responsibility_not_modeled", severity: "review", field: "responsibilityId" });

  if (findings.some((finding) => finding.severity === "error") || !leaseId || !propertyId || !sourceLeaseVersion || !start || !asOf || !through) {
    return emptyPreview(findings);
  }

  const normalized: NormalizedLeaseChargeScheduleInput = {
    leaseId,
    propertyId,
    unitId: cleanAccountingString(input.unitId),
    responsibilityId,
    tenantId: cleanAccountingString(input.tenantId),
    sourceLeaseVersion,
    leaseStartDate: start.value,
    leaseEndDate: end?.value || null,
    monthlyRentCents: Number(monthlyRentCents),
    dueDay: Number(dueDay),
    currency: "cad",
    billingFrequency: "monthly",
    depositAmountCents,
    asOfDate: asOf.value,
    previewThroughDate: through.value,
  };

  const finalEpochDay = Math.min(through.epochDay, end?.epochDay ?? through.epochDay);
  let cursor = start.day > normalized.dueDay ? addUtcMonths(start.year, start.month) : { year: start.year, month: start.month };
  const occurrences: LeaseChargeOccurrence[] = [];
  if (start.day > normalized.dueDay) {
    findings.push({ code: "proration_policy_required", severity: "review", field: "leaseStartDate" });
  }
  if (end && end.day < daysInUtcMonth(end.year, end.month)) {
    findings.push({ code: "proration_policy_required", severity: "review", field: "leaseEndDate" });
  }

  while (occurrences.length < MAX_CHARGE_SCHEDULE_OCCURRENCES) {
    const dueDate = formatDateOnly(cursor.year, cursor.month, Math.min(normalized.dueDay, daysInUtcMonth(cursor.year, cursor.month)));
    const due = parseDateOnly(dueDate)!;
    if (due.epochDay > finalEpochDay) break;
    if (due.epochDay >= start.epochDay) {
      const periodStart = formatDateOnly(cursor.year, cursor.month, 1);
      const periodEnd = formatDateOnly(cursor.year, cursor.month, daysInUtcMonth(cursor.year, cursor.month));
      const base = {
        type: "scheduled_rent_charge" as const,
        amountCents: normalized.monthlyRentCents,
        currency: "cad" as const,
        dueDate,
        periodStart,
        periodEnd,
        sourceLeaseVersion: normalized.sourceLeaseVersion,
        policyReviewRequired: findings.some((finding) => finding.code === "proration_policy_required"),
      };
      occurrences.push({ ...base, occurrenceKey: occurrenceKey(normalized, base) });
    }
    cursor = addUtcMonths(cursor.year, cursor.month);
  }

  const nextDueDate = formatDateOnly(cursor.year, cursor.month, Math.min(normalized.dueDay, daysInUtcMonth(cursor.year, cursor.month)));
  if (parseDateOnly(nextDueDate)!.epochDay <= finalEpochDay) {
    findings.push({ code: "preview_horizon_exceeds_max_occurrences", severity: "error", field: "previewThroughDate" });
  }

  if (depositAmountCents) {
    const base = {
      type: "deposit_charge" as const,
      amountCents: depositAmountCents,
      currency: "cad" as const,
      dueDate: start.value,
      periodStart: start.value,
      periodEnd: start.value,
      sourceLeaseVersion: normalized.sourceLeaseVersion,
      policyReviewRequired: false,
    };
    occurrences.push({ ...base, occurrenceKey: occurrenceKey(normalized, base) });
  }

  occurrences.sort((a, b) =>
    [a.dueDate, a.type === "deposit_charge" ? "0" : "1", a.occurrenceKey]
      .join(":")
      .localeCompare([b.dueDate, b.type === "deposit_charge" ? "0" : "1", b.occurrenceKey].join(":"))
  );
  const sortedFindings = sortReceivableFindings(findings);
  const totals = {
    scheduledRentCents: occurrences.filter((row) => row.type === "scheduled_rent_charge").reduce((sum, row) => sum + row.amountCents, 0),
    depositChargeCents: occurrences.filter((row) => row.type === "deposit_charge").reduce((sum, row) => sum + row.amountCents, 0),
    occurrenceCount: occurrences.length,
  };
  const fingerprintPayload = {
    schemaVersion: "lease_charge_schedule_preview_v1",
    ...normalized,
    occurrences,
    findings: sortedFindings.map((finding) => finding.code),
  };
  return {
    allowed: !sortedFindings.some((finding) => finding.severity === "error"),
    normalizedInput: normalized,
    occurrences,
    totals,
    findings: sortedFindings,
    previewFingerprint: buildReceivablesFingerprint(fingerprintPayload),
  };
}
