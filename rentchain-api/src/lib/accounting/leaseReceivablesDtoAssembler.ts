import { projectReceivableAging } from "./agingProjection";
import { projectReceivableBalance } from "./balanceProjection";
import { buildLeaseChargeSchedulePreview } from "./chargeSchedulePreview";
import {
  LANDLORD_LEASE_RECEIVABLES_SCHEMA_VERSION,
  type LandlordLeaseReceivablesAssemblerInput,
  type LandlordLeaseReceivablesDto,
  type LandlordSafeWarning,
  type LeaseReceivablesCompletenessStatus,
} from "./leaseReceivablesDtoTypes";
import {
  RECEIVABLE_SCHEDULE_STATE_STALE,
  buildReceivablesFingerprint,
  validateChargeSchedulePreviewFingerprint,
} from "./receivablesFingerprint";
import { projectRentRoll } from "./rentRollProjection";
import { cleanAccountingString, parseDateOnly, type ReceivableFinding } from "./receivablesTypes";

const LEASE_STATUS_LABELS = {
  active: "Active",
  signed_future: "Signed - upcoming",
  notice_period: "Notice period",
  ended: "Ended",
  unknown: "Status not provided",
} as const;
const LEASE_STATUSES = new Set(Object.keys(LEASE_STATUS_LABELS));
const TENANT_MAPPING_STATES = new Set(["resolved", "missing", "ambiguous"]);
const ACCOUNTING_SOURCE_STATES = new Set(["complete", "incomplete", "ambiguous"]);

const SAFE_FINDING_MESSAGES: Record<string, string> = {
  adjustment_direction_required: "An adjustment is missing its direction.",
  allocation_required: "A payment or credit requires allocation review.",
  allocation_target_not_found: "An allocation target could not be confirmed.",
  charge_due_date_required: "A charge is missing its due date.",
  duplicate_payment_reversal: "A payment has more than one reversal record.",
  duplicate_transaction_id: "Duplicate receivable records require review.",
  invalid_amount_cents: "A receivable amount is invalid.",
  invalid_deposit_amount_cents: "The deposit charge amount is invalid.",
  invalid_date_only: "An accounting date is missing or invalid.",
  invalid_due_day: "A valid monthly due day is required.",
  invalid_monthly_rent_cents: "A valid monthly rent amount is required.",
  invalid_payment_reversal_target: "A payment reversal target could not be confirmed.",
  invalid_period_range: "A receivable period is invalid.",
  lease_end_before_start: "The lease end date is before the lease start date.",
  payment_reversal_mismatch: "A payment reversal does not match the original payment.",
  preview_horizon_before_lease: "The schedule preview ends before the lease starts.",
  preview_horizon_exceeds_max_occurrences: "The schedule preview exceeds the supported horizon.",
  proration_policy_required: "Partial-month billing requires policy review.",
  required_field_missing: "Required accounting source data is missing.",
  self_reversal_not_allowed: "A payment record cannot reverse itself.",
  unapplied_reduction_balance: "Part of a payment or credit remains unallocated.",
  unsupported_billing_frequency: "The billing frequency is unsupported.",
  unsupported_currency: "The accounting currency is unsupported.",
  unsupported_transaction_type: "A receivable record type is unsupported.",
};

const DISPLAY_FIELDS = [
  ["property_display_not_provided", "property display name", "Property name is not provided."],
  ["unit_display_not_provided", "unit display name", "Unit name is not provided."],
  ["tenant_display_not_provided", "tenant display name", "Tenant name is not provided."],
] as const;

function formatCad(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(cents);
  return `${sign}$${Math.floor(absolute / 100).toLocaleString("en-CA")}.${String(absolute % 100).padStart(2, "0")} CAD`;
}

function safeWarning(code: string, message: string, severity: "review" | "info" = "review"): LandlordSafeWarning {
  return { code, severity, message };
}

function projectedWarnings(findings: readonly ReceivableFinding[]): LandlordSafeWarning[] {
  return findings
    .filter((finding) => SAFE_FINDING_MESSAGES[finding.code])
    .map((finding) => safeWarning(finding.code, SAFE_FINDING_MESSAGES[finding.code], finding.severity === "info" ? "info" : "review"));
}

function uniqueWarnings(warnings: readonly LandlordSafeWarning[]): LandlordSafeWarning[] {
  const byCode = new Map<string, LandlordSafeWarning>();
  for (const warning of warnings) {
    const current = byCode.get(warning.code);
    if (!current || (current.severity === "info" && warning.severity === "review")) byCode.set(warning.code, warning);
  }
  return [...byCode.values()].sort((a, b) => [a.code, a.severity].join(":").localeCompare([b.code, b.severity].join(":")));
}

function nextScheduleDueDate(occurrences: readonly { type: string; dueDate: string }[], asOfDate: string): string | null {
  const asOf = parseDateOnly(asOfDate);
  if (!asOf) return null;
  return occurrences
    .filter((row) => row.type === "scheduled_rent_charge")
    .map((row) => row.dueDate)
    .find((dueDate) => parseDateOnly(dueDate)!.epochDay >= asOf.epochDay) || null;
}

export function assembleLandlordLeaseReceivablesDto(
  input: LandlordLeaseReceivablesAssemblerInput
): LandlordLeaseReceivablesDto {
  const warnings: LandlordSafeWarning[] = [];
  const missing = new Set<string>();
  const leaseId = cleanAccountingString(input.leaseId);
  const propertyId = cleanAccountingString(input.propertyId);
  const propertyDisplayName = cleanAccountingString(input.propertyDisplayName);
  const unitDisplayName = cleanAccountingString(input.unitDisplayName);
  const tenantDisplayName = cleanAccountingString(input.tenantDisplayName);
  const responsibilityDisplayName = cleanAccountingString(input.responsibilityDisplayName);
  const asOf = parseDateOnly(input.asOfDate);
  const leaseStatusValue = cleanAccountingString(input.leaseStatus, 40);
  const leaseStatus = leaseStatusValue && LEASE_STATUSES.has(leaseStatusValue)
    ? (leaseStatusValue as keyof typeof LEASE_STATUS_LABELS)
    : "unknown";
  const tenantMappingValue = cleanAccountingString(input.tenantMappingState, 40);
  const tenantMappingState = tenantMappingValue && TENANT_MAPPING_STATES.has(tenantMappingValue)
    ? tenantMappingValue
    : "invalid";
  const transactionSourceValue = cleanAccountingString(input.transactionSourceState, 40);
  const transactionSourceState = transactionSourceValue && ACCOUNTING_SOURCE_STATES.has(transactionSourceValue)
    ? transactionSourceValue
    : "invalid";

  if (leaseStatus === "unknown" && leaseStatusValue !== "unknown") {
    warnings.push(safeWarning("lease_status_unknown", "Lease status is not available.", "info"));
  }

  const displayValues = [propertyDisplayName, unitDisplayName, tenantDisplayName] as const;
  DISPLAY_FIELDS.forEach(([code, field, message], index) => {
    if (!displayValues[index]) {
      missing.add(field);
      warnings.push(safeWarning(code, message, "info"));
    }
  });
  if (!responsibilityDisplayName) {
    missing.add("responsibility display name");
    warnings.push(safeWarning("responsibility_display_not_provided", "Responsibility name is not provided.", "info"));
  }
  if (tenantMappingState === "ambiguous") {
    missing.add("unambiguous tenant mapping");
    warnings.push(safeWarning("tenant_mapping_ambiguous", "Tenant mapping is ambiguous and requires review."));
  } else if (tenantMappingState === "missing") {
    missing.add("tenant mapping");
    warnings.push(safeWarning("tenant_mapping_missing", "Tenant mapping is not available."));
  } else if (tenantMappingState === "invalid") {
    missing.add("valid tenant mapping state");
    warnings.push(safeWarning("tenant_mapping_state_invalid", "Tenant mapping state is invalid."));
  }
  if (!asOf) {
    missing.add("valid as-of date");
    warnings.push(safeWarning("as_of_date_invalid", "A valid as-of date is required."));
  }
  if (!leaseId) {
    missing.add("lease scope");
    warnings.push(safeWarning("lease_scope_missing", "Lease scope is not available."));
  }
  if (!propertyId) {
    missing.add("property scope");
    warnings.push(safeWarning("property_scope_missing", "Property scope is not available."));
  }
  if (transactionSourceState !== "complete") {
    missing.add(transactionSourceState === "ambiguous" ? "unambiguous receivable source" : "complete receivable source");
    warnings.push(
      safeWarning(
        transactionSourceState === "ambiguous"
          ? "receivable_source_ambiguous"
          : transactionSourceState === "invalid"
            ? "receivable_source_state_invalid"
            : "receivable_source_incomplete",
        transactionSourceState === "ambiguous"
          ? "Receivable source mapping is ambiguous."
          : transactionSourceState === "invalid"
            ? "Receivable source state is invalid."
            : "Receivable source data is incomplete."
      )
    );
  }

  const schedule = buildLeaseChargeSchedulePreview({
    leaseId: input.leaseId,
    propertyId: input.propertyId,
    unitId: input.unitId,
    responsibilityId: input.responsibilityId,
    tenantId: input.tenantId,
    sourceLeaseVersion: input.sourceLeaseVersion,
    leaseStartDate: input.leaseStartDate,
    leaseEndDate: input.leaseEndDate,
    monthlyRentCents: input.monthlyRentCents,
    dueDay: input.dueDay,
    currency: input.currency,
    billingFrequency: input.billingFrequency,
    depositAmountCents: input.depositAmountCents,
    asOfDate: input.asOfDate,
    previewThroughDate: input.previewThroughDate,
  });
  const scheduleErrors = schedule.findings.filter((finding) => finding.severity === "error");
  for (const finding of scheduleErrors) missing.add(finding.field || "complete billing terms");
  warnings.push(...projectedWarnings(schedule.findings));

  const expectedPreviewFingerprint = cleanAccountingString(input.expectedPreviewFingerprint);
  const fingerprintValidation = expectedPreviewFingerprint && schedule.allowed
    ? validateChargeSchedulePreviewFingerprint({
        expectedPreviewFingerprint,
        currentPreviewFingerprint: schedule.previewFingerprint,
      })
    : { ok: true as const };
  const stale = !fingerprintValidation.ok && fingerprintValidation.code === RECEIVABLE_SCHEDULE_STATE_STALE;
  if (stale) warnings.push(safeWarning("receivable_schedule_state_stale", "Billing terms changed after the earlier schedule preview."));

  const financialSourceReady = Boolean(
    leaseId &&
      propertyId &&
      asOf &&
      transactionSourceState === "complete" &&
      tenantMappingState === "resolved"
  );
  const balance = financialSourceReady
    ? projectReceivableBalance(input.transactions, { leaseId: leaseId!, propertyId: propertyId!, asOfDate: asOf!.value })
    : null;
  const aging = financialSourceReady
    ? projectReceivableAging({
        transactions: input.transactions,
        leaseId: leaseId!,
        propertyId: propertyId!,
        asOfDate: asOf!.value,
        allocationPolicy: input.agingAllocationPolicy || "explicit",
      })
    : null;
  if (balance) warnings.push(...projectedWarnings(balance.findings));
  if (aging) warnings.push(...projectedWarnings(aging.findings));
  const accountingErrors = [...(balance?.findings || []), ...(aging?.findings || [])].filter((finding) => finding.severity === "error");
  for (const finding of accountingErrors) missing.add(finding.field || "valid receivable source data");
  const accountingReady = Boolean(balance && aging && accountingErrors.length === 0);

  let sourceEquivalence: LandlordLeaseReceivablesDto["sourceEquivalence"] = { status: "not_provided" };
  if (!accountingReady) {
    sourceEquivalence = { status: "unavailable" };
  } else if (input.legacyBalanceCents !== undefined && input.legacyBalanceCents !== null) {
    if (!Number.isSafeInteger(input.legacyBalanceCents)) {
      sourceEquivalence = { status: "mismatch" };
      missing.add("valid legacy balance comparison");
      warnings.push(safeWarning("legacy_balance_invalid", "The legacy balance comparison is invalid."));
    } else if (Number(input.legacyBalanceCents) !== balance!.netBalanceCents) {
      sourceEquivalence = { status: "mismatch" };
      missing.add("equivalent legacy balance");
      warnings.push(safeWarning("legacy_balance_mismatch", "The receivable balance does not match the legacy balance."));
    } else {
      sourceEquivalence = { status: "equivalent" };
    }
  }
  const legacyMismatch = sourceEquivalence.status === "mismatch";
  const financialOutputReady = accountingReady && !legacyMismatch;

  const rentRoll = schedule.allowed && financialOutputReady
    ? projectRentRoll({
        leases: [
          {
            propertyId: propertyId!,
            propertyDisplay: propertyDisplayName,
            unitId: cleanAccountingString(input.unitId),
            unitDisplay: unitDisplayName,
            leaseId: leaseId!,
            responsibilityId: cleanAccountingString(input.responsibilityId),
            tenantDisplayName,
            leaseStatus,
            scheduledRentCents: schedule.normalizedInput!.monthlyRentCents,
            currency: "cad",
            nextDueDate: nextScheduleDueDate(schedule.occurrences, asOf!.value),
            transactions: input.transactions,
          },
        ],
        asOfDate: asOf!.value,
        agingAllocationPolicy: input.agingAllocationPolicy || "explicit",
      })
    : null;
  if (rentRoll) warnings.push(...projectedWarnings(rentRoll.findings));
  const rentRollHasErrors = Boolean(rentRoll?.findings.some((finding) => finding.severity === "error"));
  if (rentRollHasErrors) missing.add("valid rent roll source data");
  const rentRollRow = !rentRollHasErrors ? rentRoll?.rows[0] || null : null;

  let completenessStatus: LeaseReceivablesCompletenessStatus = "complete";
  if (!financialOutputReady) completenessStatus = "unavailable";
  else if (!schedule.allowed || stale || missing.size > 0 || warnings.length > 0 || !rentRollRow) completenessStatus = "partial";

  const monthlyRentCents = schedule.normalizedInput?.monthlyRentCents ?? null;
  const nextDueDate = schedule.allowed && asOf ? nextScheduleDueDate(schedule.occurrences, asOf.value) : null;
  const sourceFingerprint = buildReceivablesFingerprint({
    schemaVersion: LANDLORD_LEASE_RECEIVABLES_SCHEMA_VERSION,
    leaseId,
    propertyId,
    unitId: cleanAccountingString(input.unitId),
    responsibilityId: cleanAccountingString(input.responsibilityId),
    tenantId: cleanAccountingString(input.tenantId),
    tenantMappingState,
    transactionSourceState,
    asOfDate: asOf?.value || null,
    scheduleFingerprint: schedule.previewFingerprint,
    transactions: input.transactions,
  });

  return {
    schemaVersion: LANDLORD_LEASE_RECEIVABLES_SCHEMA_VERSION,
    asOfDate: asOf?.value || null,
    currency: "cad",
    leaseSummary: {
      propertyDisplayName,
      unitDisplayName,
      tenantDisplayName: tenantMappingState === "resolved" ? tenantDisplayName : null,
      responsibilityDisplayName,
      leaseStatus,
      leaseStatusLabel: LEASE_STATUS_LABELS[leaseStatus],
    },
    billingSummary: {
      monthlyRentCents,
      scheduledRentDisplay: monthlyRentCents === null ? null : formatCad(monthlyRentCents),
      billingFrequency: schedule.normalizedInput?.billingFrequency || null,
      dueDay: schedule.normalizedInput?.dueDay ?? null,
      leaseStartDate: schedule.normalizedInput?.leaseStartDate || null,
      leaseEndDate: schedule.normalizedInput?.leaseEndDate || null,
    },
    balanceSummary: financialOutputReady
      ? {
          chargesCents: balance!.chargeCents,
          creditsCents: balance!.creditCents,
          appliedPaymentsCents: balance!.appliedPaymentCents,
          reversalsCents: balance!.reversalCents,
          writeOffsCents: balance!.writeOffCents,
          adjustmentIncreasesCents: balance!.adjustmentIncreaseCents,
          adjustmentDecreasesCents: balance!.adjustmentDecreaseCents,
          netBalanceCents: balance!.netBalanceCents,
          outstandingCents: balance!.outstandingCents,
          overpaymentCents: balance!.overpaymentCents,
          balanceDisplay: formatCad(balance!.netBalanceCents),
        }
      : null,
    agingSummary: financialOutputReady
      ? {
          allocationPolicy: aging!.allocationPolicy,
          currentCents: aging!.currentCents,
          days1To30Cents: aging!.days1To30Cents,
          days31To60Cents: aging!.days31To60Cents,
          days61To90Cents: aging!.days61To90Cents,
          days90PlusCents: aging!.days90PlusCents,
          totalOutstandingCents: aging!.totalOutstandingCents,
        }
      : null,
    rentRollSummary: rentRollRow
      ? {
          scheduledRentCents: rentRollRow.scheduledRentCents,
          currentBalanceCents: rentRollRow.currentBalanceCents,
          outstandingCents: rentRollRow.outstandingCents,
          overpaymentCents: rentRollRow.overpaymentCents,
          nextDueDate: rentRollRow.nextDueDate,
        }
      : null,
    schedulePreviewSummary: {
      status: schedule.allowed ? "available" : "unavailable",
      scheduledRentCents: schedule.allowed ? schedule.totals.scheduledRentCents : null,
      depositChargeCents: schedule.allowed ? schedule.totals.depositChargeCents : null,
      occurrenceCount: schedule.allowed ? schedule.totals.occurrenceCount : null,
      nextDueDate,
      previewFingerprint: schedule.allowed ? schedule.previewFingerprint : null,
      stale,
    },
    sourceEquivalence,
    dataCompleteness: {
      status: completenessStatus,
      missing: [...missing].sort(),
    },
    warnings: uniqueWarnings(warnings),
    sourceFingerprint,
  };
}
