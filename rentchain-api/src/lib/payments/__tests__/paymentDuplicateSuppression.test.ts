import { describe, expect, it } from "vitest";
import { derivePaymentDuplicateSuppressionDecision } from "../paymentDuplicateSuppression";

describe("derivePaymentDuplicateSuppressionDecision", () => {
  it("marks processed receipts as future suppress candidates", () => {
    expect(
      derivePaymentDuplicateSuppressionDecision({
        receipt: {
          status: "processed",
          duplicateCount: 2,
        },
      })
    ).toEqual({
      shouldSuppress: true,
      reason: "provider_event_already_processed",
      existingReceiptStatus: "processed",
      duplicateCount: 2,
      safeToAcknowledge: true,
      requiresManualReview: false,
    });
  });

  it("does not suppress failed receipts", () => {
    expect(
      derivePaymentDuplicateSuppressionDecision({
        receipt: {
          status: "failed",
          duplicateCount: 1,
        },
      })
    ).toEqual({
      shouldSuppress: false,
      reason: "provider_event_previous_processing_failed",
      existingReceiptStatus: "failed",
      duplicateCount: 1,
      safeToAcknowledge: false,
      requiresManualReview: true,
    });
  });

  it("does not suppress manual review receipts", () => {
    expect(
      derivePaymentDuplicateSuppressionDecision({
        receipt: {
          status: "manual_review_required",
          duplicateCount: 1,
        },
      })
    ).toEqual({
      shouldSuppress: false,
      reason: "provider_event_manual_review_required",
      existingReceiptStatus: "manual_review_required",
      duplicateCount: 1,
      safeToAcknowledge: true,
      requiresManualReview: true,
    });
  });

  it("does not suppress missing receipts", () => {
    expect(derivePaymentDuplicateSuppressionDecision({ receipt: null })).toEqual({
      shouldSuppress: false,
      reason: "provider_event_receipt_missing",
      existingReceiptStatus: null,
      duplicateCount: 0,
      safeToAcknowledge: false,
      requiresManualReview: false,
    });
  });

  it("fails closed for unknown receipt statuses", () => {
    expect(
      derivePaymentDuplicateSuppressionDecision({
        receipt: {
          status: "settled" as any,
          duplicateCount: 3,
        },
      })
    ).toEqual({
      shouldSuppress: false,
      reason: "provider_event_receipt_status_unknown",
      existingReceiptStatus: "unknown",
      duplicateCount: 3,
      safeToAcknowledge: false,
      requiresManualReview: true,
    });
  });
});
