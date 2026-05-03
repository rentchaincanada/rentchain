export const PAYMENT_CANONICAL_EVENTS = [
  "payment.intent_created",
  "payment.provider_selected",
  "payment.provider_session_created",
  "payment.provider_signal_received",
  "payment.initiated",
  "payment.pending",
  "payment.confirmed",
  "payment.failed",
  "payment.cancelled",
  "payment.expired",
  "payment.mismatch_detected",
  "payment.duplicate_detected",
  "payment.manual_review_required",
  "payment.reconciled",
  "payment.reconciliation_failed",
  "payout.initiated",
  "payout.completed",
  "payout.failed",
  "affordability.verification_started",
  "affordability.verification_completed",
  "affordability.verification_failed",
] as const;

export type PaymentCanonicalEventName = (typeof PAYMENT_CANONICAL_EVENTS)[number];

export function isPaymentCanonicalEventName(value: unknown): value is PaymentCanonicalEventName {
  return (PAYMENT_CANONICAL_EVENTS as readonly string[]).includes(String(value || "").trim());
}
