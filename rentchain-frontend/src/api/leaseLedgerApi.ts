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

export type LeaseCreditAllocationStatus = "active" | "reversed";

export type LeaseCreditAllocationPreviewObligation = {
  obligationKey: string;
  obligationRowId: string;
  leaseId: string;
  propertyId?: string | null;
  unitId?: string | null;
  tenantId?: string | null;
  paymentIntentId?: string | null;
  rentPaymentId?: string | null;
  paymentDocumentId?: string | null;
  dueDate?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  expectedAmountCents: number;
  paidAmountCents: number;
  existingActiveAllocationAmountCents: number;
  outstandingAmountCents: number;
  currency: string;
  suggestedAllocationAmountCents: number;
  afterAvailableCreditCents: number;
  obligationOutstandingAfterCents: number;
};

export type LeaseCreditAllocationSummary = {
  allocationId: string;
  landlordId: string;
  leaseId: string;
  propertyId?: string | null;
  unitId?: string | null;
  tenantId?: string | null;
  obligationRowId: string;
  obligationKey: string;
  allocationAmountCents: number;
  currency: string;
  status: LeaseCreditAllocationStatus;
  createdAt: string;
  createdBy: string;
  createdByEmail?: string | null;
  reason?: string | null;
  note?: string | null;
  beforeAvailableCreditCents: number;
  beforeOutstandingAmountCents: number;
  afterAvailableCreditCents: number;
  afterOutstandingAmountCents: number;
  previewFingerprint: string;
  idempotencyKey?: string | null;
  reversedAt?: string | null;
  reversedBy?: string | null;
  reversedByEmail?: string | null;
  reversalReason?: string | null;
  sourceType: "lease_credit_allocation";
};

export type LeaseCreditAllocationSuggestion = {
  obligationRowId: string;
  obligationKey: string;
  allocationAmountCents: number;
  beforeAvailableCreditCents: number;
  beforeOutstandingAmountCents: number;
  afterAvailableCreditCents: number;
  afterOutstandingAmountCents: number;
};

export type LeaseCreditAllocationPreview = {
  ok?: boolean;
  leaseId: string;
  landlordId: string;
  sourceType: "lease_credit_allocation";
  aggregateBalanceCents: number;
  sourceBalanceBeforeCents: number;
  grossAvailableCreditCents: number;
  activeAllocationAmountCents: number;
  availableCreditCents: number;
  eligibleObligations: LeaseCreditAllocationPreviewObligation[];
  obligations: LeaseCreditAllocationPreviewObligation[];
  suggestedAllocations: LeaseCreditAllocationSuggestion[];
  totalOutstandingAmountCents: number;
  totalSuggestedAllocationAmountCents: number;
  remainingAvailableCreditCents: number;
  previewFingerprint: string;
  blockedReasons: string[];
  allowed: boolean;
  existingActiveAllocations: LeaseCreditAllocationSummary[];
  reversedAllocations: LeaseCreditAllocationSummary[];
  noLegalOrLifecycleEffect: boolean;
};

export type ApplyCreditAllocationPayload = {
  obligationRowId: string;
  allocationAmountCents: number;
  previewFingerprint: string;
  idempotencyKey: string;
  note?: string;
};

export type ApplyCreditAllocationResponse = {
  ok: true;
  allocation: LeaseCreditAllocationSummary;
  idempotentReplay: boolean;
  beforePreview: LeaseCreditAllocationPreview;
  preview: LeaseCreditAllocationPreview;
  noLegalOrLifecycleEffect: boolean;
};

export type ReverseCreditAllocationResponse = {
  ok: true;
  allocation: LeaseCreditAllocationSummary;
  preview: LeaseCreditAllocationPreview;
  noLegalOrLifecycleEffect: boolean;
};

type CreditAllocationErrorResponse = {
  ok: false;
  error?: string;
  code?: string;
  message?: string;
  preview?: LeaseCreditAllocationPreview;
};

export class CreditAllocationApiError extends Error {
  code: string;
  preview?: LeaseCreditAllocationPreview;

  constructor(code: string, message?: string, preview?: LeaseCreditAllocationPreview) {
    super(message || code);
    this.name = "CreditAllocationApiError";
    this.code = code;
    this.preview = preview;
  }
}

function assertCreditAllocationOk<T extends { ok?: boolean }>(response: T | CreditAllocationErrorResponse): T {
  if (response && response.ok !== false) return response as T;
  const errorResponse = response as CreditAllocationErrorResponse;
  const code = errorResponse?.code || errorResponse?.error || "CREDIT_ALLOCATION_REQUEST_FAILED";
  throw new CreditAllocationApiError(code, errorResponse?.message || code, errorResponse?.preview);
}

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

export async function fetchCreditAllocationPreview(leaseId: string): Promise<LeaseCreditAllocationPreview> {
  const response = await apiFetch<LeaseCreditAllocationPreview | CreditAllocationErrorResponse>(
    `/landlord/leases/${encodeURIComponent(leaseId)}/credit-allocation-preview`,
    {
      method: "GET",
      allowStatuses: [400, 403, 404, 409],
    }
  );
  return assertCreditAllocationOk<LeaseCreditAllocationPreview>(response);
}

export async function applyCreditAllocation(
  leaseId: string,
  payload: ApplyCreditAllocationPayload
): Promise<ApplyCreditAllocationResponse> {
  const response = await apiFetch<ApplyCreditAllocationResponse | CreditAllocationErrorResponse>(
    `/landlord/leases/${encodeURIComponent(leaseId)}/credit-allocations`,
    {
      method: "POST",
      body: payload,
      allowStatuses: [400, 409],
    }
  );
  return assertCreditAllocationOk<ApplyCreditAllocationResponse>(response);
}

export async function reverseCreditAllocation(
  leaseId: string,
  allocationId: string,
  payload: { reason: string }
): Promise<ReverseCreditAllocationResponse> {
  const response = await apiFetch<ReverseCreditAllocationResponse | CreditAllocationErrorResponse>(
    `/landlord/leases/${encodeURIComponent(leaseId)}/credit-allocations/${encodeURIComponent(allocationId)}/reverse`,
    {
      method: "POST",
      body: payload,
      allowStatuses: [400, 404, 409],
    }
  );
  return assertCreditAllocationOk<ReverseCreditAllocationResponse>(response);
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
