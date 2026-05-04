import type {
  PaymentProviderEventReceipt,
  PaymentProviderEventReceiptStatus,
} from "./paymentProviderEventReceipts";

export type PaymentDuplicateSuppressionDecisionReason =
  | "provider_event_receipt_missing"
  | "provider_event_already_processed"
  | "provider_event_duplicate_already_recorded"
  | "provider_event_processing_in_progress"
  | "provider_event_previous_processing_failed"
  | "provider_event_manual_review_required"
  | "provider_event_not_processed_yet"
  | "provider_event_receipt_status_unknown";

export type PaymentDuplicateSuppressionDecision = {
  shouldSuppress: boolean;
  reason: PaymentDuplicateSuppressionDecisionReason;
  existingReceiptStatus: PaymentProviderEventReceiptStatus | "unknown" | null;
  duplicateCount: number;
  safeToAcknowledge: boolean;
  requiresManualReview: boolean;
};

type DuplicateSuppressionDecisionInput = {
  receipt?: Pick<PaymentProviderEventReceipt, "status" | "duplicateCount"> | null;
};

function normalizeDuplicateCount(value: unknown): number {
  const next = Number(value);
  if (!Number.isFinite(next) || next < 0) return 0;
  return Math.floor(next);
}

export function derivePaymentDuplicateSuppressionDecision(
  input: DuplicateSuppressionDecisionInput
): PaymentDuplicateSuppressionDecision {
  const receipt = input.receipt || null;
  if (!receipt) {
    return {
      shouldSuppress: false,
      reason: "provider_event_receipt_missing",
      existingReceiptStatus: null,
      duplicateCount: 0,
      safeToAcknowledge: false,
      requiresManualReview: false,
    };
  }

  const duplicateCount = normalizeDuplicateCount(receipt.duplicateCount);

  switch (receipt.status) {
    case "processed":
      return {
        shouldSuppress: true,
        reason: "provider_event_already_processed",
        existingReceiptStatus: "processed",
        duplicateCount,
        safeToAcknowledge: true,
        requiresManualReview: false,
      };
    case "ignored_duplicate":
      return {
        shouldSuppress: true,
        reason: "provider_event_duplicate_already_recorded",
        existingReceiptStatus: "ignored_duplicate",
        duplicateCount,
        safeToAcknowledge: true,
        requiresManualReview: false,
      };
    case "processing":
      return {
        shouldSuppress: false,
        reason: "provider_event_processing_in_progress",
        existingReceiptStatus: "processing",
        duplicateCount,
        safeToAcknowledge: false,
        requiresManualReview: true,
      };
    case "failed":
      return {
        shouldSuppress: false,
        reason: "provider_event_previous_processing_failed",
        existingReceiptStatus: "failed",
        duplicateCount,
        safeToAcknowledge: false,
        requiresManualReview: true,
      };
    case "manual_review_required":
      return {
        shouldSuppress: false,
        reason: "provider_event_manual_review_required",
        existingReceiptStatus: "manual_review_required",
        duplicateCount,
        safeToAcknowledge: true,
        requiresManualReview: true,
      };
    case "received":
      return {
        shouldSuppress: false,
        reason: "provider_event_not_processed_yet",
        existingReceiptStatus: "received",
        duplicateCount,
        safeToAcknowledge: false,
        requiresManualReview: false,
      };
    default:
      return {
        shouldSuppress: false,
        reason: "provider_event_receipt_status_unknown",
        existingReceiptStatus: "unknown",
        duplicateCount,
        safeToAcknowledge: false,
        requiresManualReview: true,
      };
  }
}
