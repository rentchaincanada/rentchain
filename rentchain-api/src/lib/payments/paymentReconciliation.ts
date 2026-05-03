import type { NormalizedProviderPaymentEvent } from "./paymentProviderAdapter";
import type { PaymentExecutionStatus, PaymentIntentReference } from "./paymentTypes";

export type PaymentReconciliationStatus =
  | "not_started"
  | "pending_provider_confirmation"
  | "pending_settlement"
  | "confirmed"
  | "failed"
  | "mismatch"
  | "duplicate_risk"
  | "manual_review_required"
  | "reconciled";

export type ExistingPaymentReconciliationState = {
  seenProviderEventIds?: string[];
  status?: PaymentReconciliationStatus | null;
};

export type PaymentReconciliationResult = {
  reconciliationStatus: PaymentReconciliationStatus;
  reasons: string[];
  automationEligible: boolean;
  requiresManualReview: boolean;
};

function normalizeCurrency(value: unknown): string {
  return String(value || "").trim().toUpperCase();
}

function isMissingSubjectReference(intent: PaymentIntentReference | null | undefined): boolean {
  if (!intent) return true;
  if (!String(intent.paymentIntentId || "").trim()) return true;
  if (!String(intent.landlordId || "").trim()) return true;
  if (intent.purpose === "rent" || intent.purpose === "deposit") {
    return !String(intent.leaseId || "").trim() && !String(intent.tenantId || "").trim();
  }
  if (intent.purpose === "screening") {
    return !String(intent.screeningOrderId || "").trim();
  }
  if (intent.purpose === "subscription") {
    return !String(intent.subscriptionId || "").trim();
  }
  return false;
}

function result(
  reconciliationStatus: PaymentReconciliationStatus,
  reasons: string[],
  options?: { automationEligible?: boolean; requiresManualReview?: boolean }
): PaymentReconciliationResult {
  return {
    reconciliationStatus,
    reasons,
    automationEligible: options?.automationEligible === true,
    requiresManualReview: options?.requiresManualReview === true,
  };
}

function isDuplicateProviderEvent(
  signal: NormalizedProviderPaymentEvent | null | undefined,
  existing: ExistingPaymentReconciliationState | null | undefined
): boolean {
  const eventId = String(signal?.providerEventId || "").trim();
  if (!eventId) return false;
  return Boolean(existing?.seenProviderEventIds?.includes(eventId));
}

export function derivePaymentReconciliation(params: {
  expectedIntent?: PaymentIntentReference | null;
  providerSignal?: NormalizedProviderPaymentEvent | null;
  existingState?: ExistingPaymentReconciliationState | null;
}): PaymentReconciliationResult {
  const expected = params.expectedIntent || null;
  const signal = params.providerSignal || null;
  const reasons: string[] = [];

  if (isMissingSubjectReference(expected)) {
    return result("manual_review_required", ["missing_internal_subject_reference"], {
      requiresManualReview: true,
    });
  }
  const checkedExpected = expected as PaymentIntentReference;

  if (!signal) {
    return result("manual_review_required", ["missing_provider_signal"], {
      requiresManualReview: true,
    });
  }

  if (isDuplicateProviderEvent(signal, params.existingState)) {
    return result("duplicate_risk", ["duplicate_provider_event"], {
      requiresManualReview: true,
    });
  }

  if (typeof signal.amount === "number" && Number.isFinite(signal.amount) && signal.amount !== checkedExpected.amount) {
    reasons.push("amount_mismatch");
  }

  if (normalizeCurrency(signal.currency) && normalizeCurrency(signal.currency) !== normalizeCurrency(checkedExpected.currency)) {
    reasons.push("currency_mismatch");
  }

  if (reasons.length > 0) {
    return result("mismatch", reasons, { requiresManualReview: true });
  }

  const status: PaymentExecutionStatus = signal.normalizedStatus;
  if (status === "confirmed" || status === "reconciled") {
    return result("reconciled", ["provider_confirmed_amount_currency_match"], {
      automationEligible: true,
      requiresManualReview: false,
    });
  }
  if (status === "pending_settlement") {
    return result("pending_settlement", ["provider_signal_pending_settlement"]);
  }
  if (
    status === "initiated" ||
    status === "provider_session_created" ||
    status === "pending_provider_confirmation"
  ) {
    return result("pending_provider_confirmation", ["provider_signal_pending_confirmation"]);
  }
  if (status === "failed" || status === "cancelled" || status === "expired") {
    return result("failed", [`provider_signal_${status}`]);
  }
  if (status === "duplicate_risk") {
    return result("duplicate_risk", ["provider_signal_duplicate_risk"], { requiresManualReview: true });
  }
  if (status === "mismatch") {
    return result("mismatch", ["provider_signal_mismatch"], { requiresManualReview: true });
  }

  return result("manual_review_required", ["provider_status_unknown_or_manual_review"], {
    requiresManualReview: true,
  });
}
