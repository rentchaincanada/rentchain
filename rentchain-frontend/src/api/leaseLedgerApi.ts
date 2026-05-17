import { apiFetch } from "./apiFetch";
import { API_BASE_URL } from "./config";
import type { DecisionItem } from "@/lib/decisions/decisionDisplay";

export type LeaseLedgerEntry = {
  id: string;
  leaseId: string;
  propertyId?: string | null;
  unitId?: string | null;
  entryType: "charge" | "payment";
  category: "rent" | "fee" | "adjustment" | "payment";
  amountCents: number;
  effectiveDate: string;
  method?: "cash" | "etransfer" | "cheque" | "bank" | "card" | "other" | null;
  reference?: string | null;
  notes?: string | null;
  createdAt: number;
  signedAmountCents: number;
  balanceCents: number;
};

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

export type LeaseObligationLedgerRow = {
  rowId: string;
  leaseId: string;
  paymentIntentId?: string | null;
  rentPaymentId?: string | null;
  paymentDocumentId?: string | null;
  propertyId?: string | null;
  unitId?: string | null;
  tenantId?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  dueDate?: string | null;
  expectedAmountCents: number;
  paidAmountCents?: number;
  currency: string;
  obligationStatus: PaymentObligationStatus;
  paymentIntentStatus?: string | null;
  rentPaymentStatus?: string | null;
  reconciliationStatus?: string | null;
  evidenceStatus?: "none" | "provider_received" | "reconciled" | "manual_review_required" | "failed" | "pending" | null;
  source: "lease_lifecycle" | "payment_intent" | "rent_payment" | "canonical_payment" | "reconciliation";
  reasons: string[];
};

export type LeaseObligationLedgerSummary = {
  totalRows: number;
  expectedAmountCents: number;
  paidAmountCents: number;
  outstandingAmountCents: number;
  statusCounts: Record<PaymentObligationStatus, number>;
  manualReviewCount: number;
};

export type DelinquencySignalType =
  | "rent_due"
  | "overdue"
  | "partially_paid"
  | "failed_payment"
  | "missing_payment"
  | "manual_review_required";

export type DelinquencySeverity = "info" | "warning" | "critical";

export type LeaseDelinquencySignal = {
  signalId: string;
  leaseId: string;
  paymentIntentId?: string | null;
  rentPaymentId?: string | null;
  propertyId?: string | null;
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

export type LeaseDelinquencySummary = {
  totalSignals: number;
  overdueCount: number;
  partiallyPaidCount: number;
  failedCount: number;
  missingCount: number;
  manualReviewCount: number;
  totalOutstandingCents: number;
};

export type LeaseLedgerResponse = {
  ok: boolean;
  leaseId: string;
  entries: LeaseLedgerEntry[];
  totals: {
    chargesCents: number;
    paymentsCents: number;
    balanceCents: number;
  };
  monthlyTotals: Record<
    string,
    {
      chargesCents: number;
      paymentsCents: number;
      netCents: number;
    }
  >;
  obligationRows?: LeaseObligationLedgerRow[];
  obligationSummary?: LeaseObligationLedgerSummary;
  delinquencySignals?: LeaseDelinquencySignal[];
  delinquencySummary?: LeaseDelinquencySummary;
  decisions?: DecisionItem[];
};

export async function fetchLeaseLedger(
  leaseId: string,
  from?: string,
  to?: string
): Promise<LeaseLedgerResponse> {
  const search = new URLSearchParams();
  if (from) search.set("from", from);
  if (to) search.set("to", to);
  const qs = search.toString();
  return apiFetch(`/leases/${encodeURIComponent(leaseId)}/ledger${qs ? `?${qs}` : ""}`, {
    method: "GET",
  });
}

export async function addLeaseCharge(
  leaseId: string,
  payload: {
    amountCents: number;
    date: string;
    type: "rent" | "fee" | "adjustment";
    notes?: string;
    propertyId?: string;
    unitId?: string;
  }
) {
  return apiFetch(`/leases/${encodeURIComponent(leaseId)}/ledger/charge`, {
    method: "POST",
    body: payload,
  });
}

export async function addLeasePayment(
  leaseId: string,
  payload: {
    amountCents: number;
    date: string;
    method: "cash" | "etransfer" | "cheque" | "bank" | "card" | "other";
    reference?: string;
    notes?: string;
    propertyId?: string;
    unitId?: string;
  }
) {
  return apiFetch(`/leases/${encodeURIComponent(leaseId)}/ledger/payment`, {
    method: "POST",
    body: payload,
  });
}

export function leaseLedgerExportUrl(leaseId: string, from?: string, to?: string, format: "csv" | "pdf" = "csv"): string {
  const search = new URLSearchParams();
  if (from) search.set("from", from);
  if (to) search.set("to", to);
  const qs = search.toString();
  const base = API_BASE_URL.replace(/\/$/, "").replace(/\/api$/i, "");
  return `${base}/api/leases/${encodeURIComponent(leaseId)}/ledger/export.${format}${qs ? `?${qs}` : ""}`;
}
