import type { LeaseLifecycleResult } from "../leases/leaseLifecycle";
import type { DelinquencySignal, DelinquencySignalType } from "../payments/delinquencySignals";
import type { PaymentObligationLedgerRow } from "../payments/paymentObligationLedger";

export type DecisionType =
  | "review_overdue_rent"
  | "review_underpaid_rent"
  | "review_missing_payment"
  | "review_failed_payment"
  | "review_manual_payment_issue"
  | "review_expiring_lease"
  | "review_occupancy_conflict";

export type DecisionSeverity = "info" | "warning" | "critical";

export type DecisionStatus =
  | "detected"
  | "surfaced"
  | "reviewed"
  | "snoozed"
  | "assigned"
  | "accepted"
  | "dismissed"
  | "resolved";

export type Decision = {
  decisionId: string;
  leaseId: string;
  paymentIntentId?: string | null;
  rentPaymentId?: string | null;
  propertyId: string | null;
  unitId: string | null;
  tenantId?: string | null;
  decisionType: DecisionType;
  severity: DecisionSeverity;
  status: DecisionStatus;
  reason: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type DecisionLeaseLifecycleInput =
  | (LeaseLifecycleResult & {
      leaseId?: string | null;
      propertyId?: string | null;
      unitId?: string | null;
      tenantId?: string | null;
    })
  | null
  | undefined;

export type DeriveDecisionsInput = {
  delinquencySignals?: DelinquencySignal[] | null;
  leaseLifecycle?: DecisionLeaseLifecycleInput;
  obligationRows?: PaymentObligationLedgerRow[] | null;
  today?: unknown;
  expiringSoonThresholdDays?: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const DELINQUENCY_DECISION_MAP: Record<
  DelinquencySignalType,
  { decisionType: DecisionType; severity: DecisionSeverity; reason: string } | null
> = {
  rent_due: null,
  overdue: {
    decisionType: "review_overdue_rent",
    severity: "critical",
    reason: "Rent obligation is overdue.",
  },
  partially_paid: {
    decisionType: "review_underpaid_rent",
    severity: "warning",
    reason: "Rent obligation is partially paid.",
  },
  missing_payment: {
    decisionType: "review_missing_payment",
    severity: "critical",
    reason: "Expected rent payment is missing.",
  },
  failed_payment: {
    decisionType: "review_failed_payment",
    severity: "critical",
    reason: "Rent payment did not complete.",
  },
  manual_review_required: {
    decisionType: "review_manual_payment_issue",
    severity: "warning",
    reason: "Payment evidence requires manual review.",
  },
};

function asString(value: unknown, max = 500): string | null {
  const next = String(value ?? "").trim().slice(0, max);
  return next || null;
}

function normalizeDate(value: unknown): string | null {
  const raw = asString(value, 120);
  if (!raw) return null;
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

function todayIso(value: unknown): string {
  return normalizeDate(value) || new Date().toISOString();
}

function toDay(value: unknown): number | null {
  const normalized = normalizeDate(value);
  if (!normalized) return null;
  const parsed = new Date(normalized);
  return Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
}

function daysBetween(start: unknown, end: unknown): number | null {
  const startDay = toDay(start);
  const endDay = toDay(end);
  if (startDay == null || endDay == null) return null;
  return Math.floor((endDay - startDay) / DAY_MS);
}

function cleanIdPart(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\/\\#?]+/g, "_")
    .replace(/[^a-z0-9_.:-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function decisionIdFor(parts: unknown[]): string {
  return cleanIdPart(["decision", ...parts].filter((part) => asString(part, 240)).join(":")) || "decision:unknown";
}

function matchingObligationRow(
  signal: DelinquencySignal,
  obligationRows: PaymentObligationLedgerRow[]
): PaymentObligationLedgerRow | null {
  return (
    obligationRows.find((row) => {
      return Boolean(
        (signal.paymentIntentId && row.paymentIntentId === signal.paymentIntentId) ||
          (signal.rentPaymentId && row.rentPaymentId === signal.rentPaymentId) ||
          (signal.leaseId === row.leaseId &&
            signal.expectedAmountCents === row.expectedAmountCents &&
            (!signal.dueDate || normalizeDate(signal.dueDate) === normalizeDate(row.dueDate)))
      );
    }) || null
  );
}

function decisionFromDelinquencySignal(
  signal: DelinquencySignal,
  obligationRows: PaymentObligationLedgerRow[],
  fallbackDetectedAt: string
): Decision | null {
  const mapping = DELINQUENCY_DECISION_MAP[signal.signalType];
  if (!mapping) return null;
  const row = matchingObligationRow(signal, obligationRows);
  const timestamp = normalizeDate(signal.detectedAt) || fallbackDetectedAt;
  return {
    decisionId: decisionIdFor([mapping.decisionType, signal.signalId]),
    leaseId: asString(signal.leaseId, 240) || row?.leaseId || "unknown",
    paymentIntentId: signal.paymentIntentId || row?.paymentIntentId || null,
    rentPaymentId: signal.rentPaymentId || row?.rentPaymentId || null,
    propertyId: signal.propertyId || row?.propertyId || null,
    unitId: signal.unitId || row?.unitId || null,
    tenantId: signal.tenantId || row?.tenantId || null,
    decisionType: mapping.decisionType,
    severity: mapping.severity,
    status: "detected",
    reason: mapping.reason,
    metadata: {
      source: "delinquency_signal",
      signalId: signal.signalId,
      signalType: signal.signalType,
      signalReasons: signal.reasons || [],
      expectedAmountCents: signal.expectedAmountCents,
      paidAmountCents: signal.paidAmountCents,
      outstandingAmountCents: signal.outstandingAmountCents,
      allocatedFromCreditCents: row?.allocatedFromCreditCents ?? 0,
      outstandingAfterAllocationCents: row?.outstandingAfterAllocationCents ?? signal.outstandingAmountCents,
      allocationStatus: row?.allocationStatus || "none",
      activeAllocationIds: row?.activeAllocationIds || [],
      allocationAdjustedFinancialSignal: row?.allocationAdjustedFinancialSignal || null,
      dueDate: signal.dueDate || row?.dueDate || null,
      obligationRowId: row?.rowId || null,
      obligationStatus: row?.obligationStatus || null,
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function hasOccupancyConflictReason(lifecycle: DecisionLeaseLifecycleInput): boolean {
  return Boolean(
    lifecycle?.reasons?.some((reason) => {
      const normalized = String(reason || "").toLowerCase();
      return normalized.includes("occupancy") || normalized.includes("occupant");
    })
  );
}

function lifecycleBaseFields(lifecycle: NonNullable<DecisionLeaseLifecycleInput>) {
  return {
    leaseId: asString(lifecycle.leaseId, 240) || "unknown",
    propertyId: asString(lifecycle.propertyId, 240),
    unitId: asString(lifecycle.unitId, 240),
    tenantId: asString(lifecycle.tenantId, 240),
  };
}

function decisionsFromLeaseLifecycle(
  lifecycle: DecisionLeaseLifecycleInput,
  today: unknown,
  thresholdDays: number,
  timestamp: string
): Decision[] {
  if (!lifecycle) return [];
  const base = lifecycleBaseFields(lifecycle);
  const decisions: Decision[] = [];
  const daysUntilEnd = daysBetween(today, lifecycle.effectiveEndDate);

  if (lifecycle.state === "notice_period" && daysUntilEnd != null && daysUntilEnd >= 0 && daysUntilEnd <= thresholdDays) {
    decisions.push({
      decisionId: decisionIdFor(["review_expiring_lease", base.leaseId, lifecycle.effectiveEndDate || "no_end_date"]),
      ...base,
      decisionType: "review_expiring_lease",
      severity: daysUntilEnd <= 14 ? "critical" : "warning",
      status: "detected",
      reason: "Lease is in notice period and nearing the end of term.",
      metadata: {
        source: "lease_lifecycle",
        lifecycleState: lifecycle.state,
        lifecycleReasons: lifecycle.reasons || [],
        effectiveEndDate: lifecycle.effectiveEndDate || null,
        daysUntilEnd,
        thresholdDays,
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  if (hasOccupancyConflictReason(lifecycle)) {
    decisions.push({
      decisionId: decisionIdFor(["review_occupancy_conflict", base.leaseId, (lifecycle.reasons || []).join("_")]),
      ...base,
      decisionType: "review_occupancy_conflict",
      severity: lifecycle.requiresReview ? "critical" : "warning",
      status: "detected",
      reason: "Lease lifecycle indicates an occupancy conflict that needs review.",
      metadata: {
        source: "lease_lifecycle",
        lifecycleState: lifecycle.state,
        lifecycleReasons: lifecycle.reasons || [],
        requiresReview: lifecycle.requiresReview,
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  return decisions;
}

export function deriveDecisions(input: DeriveDecisionsInput): Decision[] {
  const timestamp = todayIso(input.today);
  const obligationRows = input.obligationRows || [];
  const delinquencyDecisions = (input.delinquencySignals || [])
    .map((signal) => decisionFromDelinquencySignal(signal, obligationRows, timestamp))
    .filter(Boolean) as Decision[];
  const lifecycleDecisions = decisionsFromLeaseLifecycle(
    input.leaseLifecycle,
    input.today || new Date(),
    input.expiringSoonThresholdDays ?? 60,
    timestamp
  );

  return [...delinquencyDecisions, ...lifecycleDecisions].sort((a, b) => a.decisionId.localeCompare(b.decisionId));
}
