export type RentPaymentRecordStatus =
  | "setup_required"
  | "checkout_created"
  | "payment_pending"
  | "paid"
  | "failed"
  | "canceled"
  | "expired";

export type RentPaymentLatestStatus = "pending" | "paid" | "failed" | "canceled" | null;

export type RentPaymentAudience = "tenant" | "landlord";

type PaymentStatusDisplayInput = {
  latestPaymentStatus?: RentPaymentRecordStatus | null;
  latestStatus?: RentPaymentLatestStatus | null;
};

type PaymentGuidanceInput = PaymentStatusDisplayInput & {
  blockedReason?: string | null;
  paymentRailEnabled?: boolean | null;
  audience: RentPaymentAudience;
};

function normalizeCode(value: string | null | undefined): string {
  return String(value || "").trim().toLowerCase();
}

export function prettyRentPaymentStatus(value: RentPaymentRecordStatus | null | undefined): string {
  switch (value) {
    case "setup_required":
      return "Payment setup required";
    case "checkout_created":
      return "Checkout started";
    case "payment_pending":
      return "Payment pending";
    case "paid":
      return "Paid";
    case "failed":
      return "Payment failed";
    case "canceled":
      return "Checkout canceled";
    case "expired":
      return "Checkout expired";
    default:
      return "No payment started";
  }
}

export function formatPaymentExperienceStatus(input: PaymentStatusDisplayInput): string {
  switch (input.latestPaymentStatus) {
    case "setup_required":
      return "Payment setup required";
    case "checkout_created":
      return "Checkout started";
    case "payment_pending":
      return "Payment confirmation pending";
    case "paid":
      return "Payment confirmed";
    case "failed":
      return "Payment failed";
    case "canceled":
      return "Checkout canceled";
    case "expired":
      return "Checkout expired";
    default:
      break;
  }

  switch (input.latestStatus) {
    case "pending":
      return "Payment confirmation pending";
    case "paid":
      return "Payment confirmed";
    case "failed":
      return "Payment failed";
    case "canceled":
      return "Checkout did not complete";
    default:
      return "No payment started";
  }
}

export function describeRentPaymentBlocker(
  blockedReason: string | null | undefined,
  audience: RentPaymentAudience
): string | null {
  switch (normalizeCode(blockedReason)) {
    case "payment_rail_not_enabled":
      return audience === "tenant"
        ? "Online rent checkout has not been enabled for this lease yet."
        : "Rent collection still needs to be enabled for this lease.";
    case "payment_readiness_not_ready":
      return "Lease payment setup details still need review before checkout can start.";
    case "missing_rent_amount":
      return "Monthly rent is missing from the lease details.";
    case "missing_tenant_link":
      return "This lease still needs a linked tenant before checkout can start.";
    case "lease_not_active":
      return "This lease is not in a status that supports rent checkout.";
    case "invalid_currency":
      return "This lease is not configured with a supported rent payment currency.";
    case "stripe_not_configured":
      return audience === "tenant"
        ? "Online rent checkout is temporarily unavailable for this lease."
        : "Online rent checkout is not available for this lease yet.";
    case "payment_already_pending":
      return "A checkout is already open for this lease. Finish the existing checkout or wait for its status to update.";
    case "payment_already_paid":
      return "The current rent payment is already confirmed.";
    default:
      return null;
  }
}

export function describeRentPaymentGuidance(input: PaymentGuidanceInput): string {
  switch (input.latestPaymentStatus) {
    case "checkout_created":
      return input.audience === "tenant"
        ? "A Stripe checkout is open for this rent payment. Finish that checkout to complete payment."
        : "A rent checkout was started and is waiting to be completed.";
    case "payment_pending":
      return input.audience === "tenant"
        ? "Your payment was submitted and is still waiting for processor confirmation. Do not retry yet."
        : "Awaiting processor confirmation.";
    case "paid":
      return input.audience === "tenant"
        ? "Your latest rent payment was confirmed successfully."
        : "Last rent payment confirmed.";
    case "failed":
      return input.audience === "tenant"
        ? "The payment attempt did not complete successfully. You can try checkout again."
        : "Last rent payment failed.";
    case "canceled":
      return input.audience === "tenant"
        ? "The checkout was canceled before payment completed. Start a new checkout when you are ready."
        : "Last checkout did not complete.";
    case "expired":
      return input.audience === "tenant"
        ? "The checkout expired before payment completed. Start a new checkout to try again."
        : "The last checkout expired before payment completed.";
    case "setup_required":
      return input.audience === "tenant"
        ? "Payment setup must be completed before rent checkout can start."
        : "Payment setup is still required before rent checkout can start.";
    default:
      break;
  }

  if (input.latestStatus === "pending") {
    return input.audience === "tenant"
      ? "Your payment was submitted and is still waiting for processor confirmation. Do not retry yet."
      : "Awaiting processor confirmation.";
  }
  if (input.latestStatus === "paid") {
    return input.audience === "tenant"
      ? "Your latest rent payment was confirmed successfully."
      : "Last rent payment confirmed.";
  }
  if (input.latestStatus === "failed") {
    return input.audience === "tenant"
      ? "The latest rent payment did not complete successfully. You can try checkout again."
      : "Last rent payment failed.";
  }
  if (input.latestStatus === "canceled") {
    return input.audience === "tenant"
      ? "The latest checkout did not complete. Start a new checkout when you are ready."
      : "Last checkout did not complete.";
  }

  const blockedDisplay = describeRentPaymentBlocker(input.blockedReason, input.audience);
  if (blockedDisplay) return blockedDisplay;

  if (input.paymentRailEnabled === false) {
    return input.audience === "tenant"
      ? "Online rent checkout is not available for this lease yet."
      : "Rent collection has not been enabled for this lease yet.";
  }

  return input.audience === "tenant" ? "No rent payment has started for this lease yet." : "No rent payment has started yet.";
}

export function mapRentPaymentCheckoutErrorMessage(value: string | null | undefined): string {
  const blockedDisplay = describeRentPaymentBlocker(value, "tenant");
  if (blockedDisplay) return blockedDisplay;

  const normalized = normalizeCode(value);
  if (!normalized) return "Unable to start rent payment checkout.";
  if (normalized === "tenant_rent_payment_checkout_failed") {
    return "Unable to start rent payment checkout.";
  }

  if (/^[a-z0-9_]+$/.test(normalized)) {
    return "Unable to start rent payment checkout.";
  }

  return String(value).trim() || "Unable to start rent payment checkout.";
}
