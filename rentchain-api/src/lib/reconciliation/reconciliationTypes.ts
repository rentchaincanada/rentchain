export type ScreeningReconciliationStatus =
  | "not_started"
  | "quoted"
  | "checkout_created"
  | "payment_pending"
  | "paid_not_fulfilled"
  | "fulfilled"
  | "blocked"
  | "expired"
  | "abandoned"
  | "mismatch"
  | "duplicate_risk"
  | "needs_review";

export type ScreeningReconciliationV1 = {
  version: "v1";
  applicationId: string;
  generatedAt: string;
  status: ScreeningReconciliationStatus;
  summary: {
    hasQuote: boolean;
    hasCheckout: boolean;
    hasPaidEvent: boolean;
    hasFulfillment: boolean;
    hasBlockedEvent: boolean;
    hasDuplicateRisk: boolean;
    hasMismatch: boolean;
    lastMeaningfulEventAt?: string | null;
  };
  metrics: {
    quoteCount?: number;
    checkoutCount?: number;
    paidCount?: number;
    completedCount?: number;
    blockedCount?: number;
    durationQuoteToCheckoutMs?: number | null;
    durationCheckoutToPaidMs?: number | null;
    durationPaidToCompletedMs?: number | null;
    inactivityMs?: number | null;
  };
  reasons: Array<{
    code: string;
    message: string;
    severity: "info" | "warning" | "blocking";
  }>;
  linkedIds?: {
    checkoutSessionId?: string | null;
    screeningOrderId?: string | null;
    quoteId?: string | null;
  };
};
