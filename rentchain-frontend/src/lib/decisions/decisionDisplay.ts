import type { DelinquencySignalType, LeaseDelinquencySignal } from "@/api/leaseLedgerApi";

export type DecisionType =
  | "review_overdue_rent"
  | "review_underpaid_rent"
  | "review_missing_payment"
  | "review_failed_payment"
  | "review_manual_payment_issue"
  | "review_expiring_lease"
  | "review_occupancy_conflict";

export type DecisionSeverity = "info" | "warning" | "critical";
export type DecisionStatus = "detected" | "surfaced" | "reviewed" | "accepted" | "dismissed" | "resolved";

export type DecisionItem = {
  decisionId: string;
  leaseId?: string | null;
  paymentIntentId?: string | null;
  rentPaymentId?: string | null;
  propertyId?: string | null;
  unitId?: string | null;
  tenantId?: string | null;
  decisionType: DecisionType;
  severity: DecisionSeverity;
  status?: DecisionStatus;
  reason: string;
  metadata?: Record<string, unknown>;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type DecisionSummary = {
  total: number;
  critical: number;
  warning: number;
  info: number;
  overdue: number;
  underpaid: number;
  missing: number;
  failed: number;
  manualReview: number;
  expiring: number;
};

export const decisionDisplayCopy: Record<DecisionType, { label: string; badge: string }> = {
  review_overdue_rent: { label: "Overdue Rent", badge: "Overdue" },
  review_underpaid_rent: { label: "Underpaid Rent", badge: "Underpaid" },
  review_missing_payment: { label: "Missing Payment", badge: "Missing" },
  review_failed_payment: { label: "Failed Payment", badge: "Failed" },
  review_manual_payment_issue: { label: "Manual Review", badge: "Manual Review" },
  review_expiring_lease: { label: "Expiring Lease", badge: "Expiring" },
  review_occupancy_conflict: { label: "Occupancy Conflict", badge: "Occupancy" },
};

export const decisionSeverityStyle: Record<DecisionSeverity, { bg: string; color: string; border: string }> = {
  critical: { bg: "#fee2e2", color: "#991b1b", border: "#fecaca" },
  warning: { bg: "#ffedd5", color: "#9a3412", border: "#fed7aa" },
  info: { bg: "#f1f5f9", color: "#334155", border: "#cbd5e1" },
};

const delinquencyDecisionMap: Record<
  DelinquencySignalType,
  { decisionType: DecisionType; severity: DecisionSeverity; reason: string } | null
> = {
  rent_due: null,
  overdue: { decisionType: "review_overdue_rent", severity: "critical", reason: "Rent past due date" },
  partially_paid: { decisionType: "review_underpaid_rent", severity: "warning", reason: "Partial payment received" },
  missing_payment: { decisionType: "review_missing_payment", severity: "critical", reason: "Expected rent payment is missing" },
  failed_payment: { decisionType: "review_failed_payment", severity: "critical", reason: "Payment did not complete" },
  manual_review_required: { decisionType: "review_manual_payment_issue", severity: "warning", reason: "Payment mismatch detected" },
};

function cleanIdPart(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\/\\#?]+/g, "_")
    .replace(/[^a-z0-9_.:-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function decisionIdFor(parts: unknown[]): string {
  return cleanIdPart(["decision", ...parts].filter(Boolean).join(":")) || "decision:unknown";
}

export function normalizeDecisionItems(value: unknown): DecisionItem[] {
  return (Array.isArray(value) ? value : [])
    .map((raw) => raw as Partial<DecisionItem>)
    .filter((item): item is DecisionItem => Boolean(item.decisionType && item.reason && item.severity))
    .map((item) => ({
      decisionId: item.decisionId || decisionIdFor([item.decisionType, item.leaseId, item.paymentIntentId, item.rentPaymentId]),
      leaseId: item.leaseId || null,
      paymentIntentId: item.paymentIntentId || null,
      rentPaymentId: item.rentPaymentId || null,
      propertyId: item.propertyId || null,
      unitId: item.unitId || null,
      tenantId: item.tenantId || null,
      decisionType: item.decisionType,
      severity: item.severity,
      status: item.status || "detected",
      reason: item.reason,
      metadata: item.metadata || {},
      createdAt: item.createdAt || null,
      updatedAt: item.updatedAt || null,
    }));
}

export function deriveDecisionItemsFromDelinquencySignals(signals: LeaseDelinquencySignal[] | null | undefined): DecisionItem[] {
  return (signals || [])
    .map((signal) => {
      const mapping = delinquencyDecisionMap[signal.signalType];
      if (!mapping) return null;
      return {
        decisionId: decisionIdFor([mapping.decisionType, signal.signalId]),
        leaseId: signal.leaseId,
        paymentIntentId: signal.paymentIntentId || null,
        rentPaymentId: signal.rentPaymentId || null,
        propertyId: signal.propertyId || null,
        unitId: signal.unitId || null,
        tenantId: signal.tenantId || null,
        decisionType: mapping.decisionType,
        severity: mapping.severity,
        status: "detected" as const,
        reason: mapping.reason,
        metadata: {
          source: "delinquency_signal",
          signalId: signal.signalId,
          signalType: signal.signalType,
          signalReasons: signal.reasons || [],
          outstandingAmountCents: signal.outstandingAmountCents,
        },
        createdAt: signal.detectedAt,
        updatedAt: signal.detectedAt,
      };
    })
    .filter(Boolean) as DecisionItem[];
}

export function decisionFromLifecycleReviewItem(item: {
  id: string;
  leaseId: string;
  propertyId?: string | null;
  unitId?: string | null;
  tenantId?: string | null;
  category: string;
  severity: DecisionSeverity;
  description: string;
  derivedLifecycleReasons?: string[];
  detectedAt?: string | null;
}): DecisionItem | null {
  if (item.category === "expired_occupancy_conflict") {
    return {
      decisionId: decisionIdFor(["review_occupancy_conflict", item.id]),
      leaseId: item.leaseId,
      propertyId: item.propertyId || null,
      unitId: item.unitId || null,
      tenantId: item.tenantId || null,
      decisionType: "review_occupancy_conflict",
      severity: item.severity === "critical" ? "critical" : "warning",
      status: "detected",
      reason: "Lease lifecycle indicates an occupancy conflict that needs review.",
      metadata: {
        source: "lease_lifecycle_review_queue",
        reviewItemId: item.id,
        reviewCategory: item.category,
        lifecycleReasons: item.derivedLifecycleReasons || [],
      },
      createdAt: item.detectedAt || null,
      updatedAt: item.detectedAt || null,
    };
  }
  if (item.category === "notice_conflict" || item.category === "renewal_ambiguity") {
    return {
      decisionId: decisionIdFor(["review_expiring_lease", item.id]),
      leaseId: item.leaseId,
      propertyId: item.propertyId || null,
      unitId: item.unitId || null,
      tenantId: item.tenantId || null,
      decisionType: "review_expiring_lease",
      severity: item.severity,
      status: "detected",
      reason: "Lease lifecycle timing or renewal context needs review.",
      metadata: {
        source: "lease_lifecycle_review_queue",
        reviewItemId: item.id,
        reviewCategory: item.category,
        lifecycleReasons: item.derivedLifecycleReasons || [],
      },
      createdAt: item.detectedAt || null,
      updatedAt: item.detectedAt || null,
    };
  }
  return null;
}

export function summarizeDecisionItems(decisions: DecisionItem[] | null | undefined): DecisionSummary {
  const rows = decisions || [];
  return {
    total: rows.length,
    critical: rows.filter((item) => item.severity === "critical").length,
    warning: rows.filter((item) => item.severity === "warning").length,
    info: rows.filter((item) => item.severity === "info").length,
    overdue: rows.filter((item) => item.decisionType === "review_overdue_rent").length,
    underpaid: rows.filter((item) => item.decisionType === "review_underpaid_rent").length,
    missing: rows.filter((item) => item.decisionType === "review_missing_payment").length,
    failed: rows.filter((item) => item.decisionType === "review_failed_payment").length,
    manualReview: rows.filter((item) => item.decisionType === "review_manual_payment_issue").length,
    expiring: rows.filter((item) => item.decisionType === "review_expiring_lease").length,
  };
}
