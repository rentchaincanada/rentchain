export type ScreeningMonetizationEligibility =
  | "eligible"
  | "ineligible"
  | "requires_upgrade"
  | "provider_unavailable";

export type ScreeningMonetizationQuoteStatus = "none" | "generated" | "expired" | "invalid";

export type ScreeningMonetizationPaymentStatus =
  | "none"
  | "pending_checkout"
  | "checkout_created"
  | "paid"
  | "failed"
  | "abandoned"
  | "waived";

export type ScreeningMonetizationFulfillmentStatus =
  | "not_started"
  | "ready"
  | "ordered"
  | "completed"
  | "blocked";

export type ScreeningMonetizationStateV1 = {
  version: "v1";
  eligibility: ScreeningMonetizationEligibility;
  quoteStatus: ScreeningMonetizationQuoteStatus;
  paymentStatus: ScreeningMonetizationPaymentStatus;
  fulfillmentStatus: ScreeningMonetizationFulfillmentStatus;
  quoteId?: string | null;
  quoteGeneratedAt?: string | null;
  quoteExpiresAt?: string | null;
  checkoutSessionId?: string | null;
  checkoutCreatedAt?: string | null;
  paidAt?: string | null;
  amount?: number | null;
  currency?: string | null;
  providerHealthSnapshot?: {
    status?: string | null;
  } | null;
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
  lastUpdatedAt?: string | null;
};

export type ScreeningMonetizationSummary = {
  eligibility: string;
  quoteStatus: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  canGenerateQuote: boolean;
  canStartCheckout: boolean;
  canRetryCheckout: boolean;
  alreadyPaid: boolean;
  blockingReason?: string | null;
  amount?: number | null;
  currency?: string | null;
};

export const SCREENING_QUOTE_TTL_MS = 30 * 60 * 1000;

function asString(value: unknown, max = 2000) {
  return String(value || "").trim().slice(0, max);
}

function asOptionalString(value: unknown, max = 2000) {
  const next = asString(value, max);
  return next || null;
}

function toIsoString(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return new Date(value).toISOString();
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? value.toISOString() : null;
  }
  const raw = String(value).trim();
  if (!raw) return null;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function toMillis(value: unknown): number | null {
  const iso = toIsoString(value);
  if (!iso) return null;
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeCurrency(value: unknown) {
  const next = asString(value, 8).toUpperCase();
  return /^[A-Z]{3}$/.test(next) ? next : null;
}

function normalizeEligibility(value: unknown): ScreeningMonetizationEligibility {
  const next = asString(value, 60).toLowerCase();
  if (next === "provider_unavailable") return "provider_unavailable";
  if (next === "requires_upgrade") return "requires_upgrade";
  if (next === "ineligible") return "ineligible";
  return "eligible";
}

function normalizeQuoteStatus(value: unknown): ScreeningMonetizationQuoteStatus {
  const next = asString(value, 60).toLowerCase();
  if (next === "generated") return "generated";
  if (next === "expired") return "expired";
  if (next === "invalid") return "invalid";
  return "none";
}

function normalizePaymentStatus(value: unknown): ScreeningMonetizationPaymentStatus {
  const next = asString(value, 60).toLowerCase();
  if (next === "pending_checkout") return "pending_checkout";
  if (next === "checkout_created") return "checkout_created";
  if (next === "paid") return "paid";
  if (next === "failed") return "failed";
  if (next === "abandoned") return "abandoned";
  if (next === "waived") return "waived";
  return "none";
}

function normalizeFulfillmentStatus(value: unknown): ScreeningMonetizationFulfillmentStatus {
  const next = asString(value, 60).toLowerCase();
  if (next === "ready") return "ready";
  if (next === "ordered") return "ordered";
  if (next === "completed") return "completed";
  if (next === "blocked") return "blocked";
  return "not_started";
}

function normalizeOrderStatus(order: any) {
  const rawStatus = asString(order?.status, 60).toLowerCase();
  const paymentStatus = asString(order?.paymentStatus, 60).toLowerCase();
  if (
    rawStatus === "paid" ||
    rawStatus === "complete" ||
    rawStatus === "completed" ||
    rawStatus === "report_ready" ||
    rawStatus === "external_completed" ||
    paymentStatus === "paid" ||
    order?.finalized === true
  ) {
    return "paid";
  }
  if (
    rawStatus === "processing" ||
    rawStatus === "external_pending" ||
    rawStatus === "queued_external" ||
    rawStatus === "kba_in_progress" ||
    rawStatus === "in_progress"
  ) {
    return "processing";
  }
  if (rawStatus === "failed" || rawStatus === "kba_failed" || paymentStatus === "failed") {
    return "failed";
  }
  return "unpaid";
}

function buildQuoteExpiresAt(quoteGeneratedAt: string | null, ttlMs = SCREENING_QUOTE_TTL_MS) {
  const generatedAt = toMillis(quoteGeneratedAt);
  if (!generatedAt) return null;
  return new Date(generatedAt + ttlMs).toISOString();
}

export function buildQuoteId(params: { applicationId: string; now?: number }) {
  const now = typeof params.now === "number" ? params.now : Date.now();
  return `quote_${asString(params.applicationId, 120)}_${now}`;
}

export function normalizeScreeningMonetizationState(input: {
  application?: any;
  latestOrder?: any;
  eligibility?: ScreeningMonetizationEligibility;
  providerHealthStatus?: string | null;
  amount?: number | null;
  currency?: string | null;
  now?: number;
}): ScreeningMonetizationStateV1 {
  const now = typeof input.now === "number" ? input.now : Date.now();
  const app = input.application || {};
  const order = input.latestOrder || null;
  const existing = (app?.screeningMonetization || {}) as any;

  let eligibility = normalizeEligibility(input.eligibility || existing.eligibility);
  let quoteStatus = normalizeQuoteStatus(existing.quoteStatus);
  let paymentStatus = normalizePaymentStatus(existing.paymentStatus);
  let fulfillmentStatus = normalizeFulfillmentStatus(existing.fulfillmentStatus);

  const appScreeningStatus = asString(app?.screeningStatus, 60).toLowerCase();
  const orderStatus = order ? normalizeOrderStatus(order) : "unpaid";
  const quoteGeneratedAt = toIsoString(existing.quoteGeneratedAt);
  const quoteExpiresAt = toIsoString(existing.quoteExpiresAt) || buildQuoteExpiresAt(quoteGeneratedAt);
  const quoteExpired = quoteStatus === "generated" && Boolean(quoteExpiresAt) && Number(toMillis(quoteExpiresAt) || 0) < now;

  if (quoteExpired) {
    quoteStatus = "expired";
  }

  if (input.providerHealthStatus === "provider_unavailable") {
    eligibility = "provider_unavailable";
  }

  if (appScreeningStatus === "paid" || orderStatus === "paid") {
    paymentStatus = "paid";
  } else if (appScreeningStatus === "failed" || orderStatus === "failed") {
    paymentStatus = "failed";
  } else if (
    order &&
    (asOptionalString(order?.stripeCheckoutSessionId, 120) ||
      asOptionalString(order?.stripeSessionId, 120) ||
      asOptionalString(order?.externalRedirectUrl, 500))
  ) {
    paymentStatus = "checkout_created";
  } else if (quoteStatus === "generated") {
    paymentStatus = paymentStatus === "none" ? "pending_checkout" : paymentStatus;
  }

  if (appScreeningStatus === "complete") {
    fulfillmentStatus = "completed";
  } else if (appScreeningStatus === "processing" || orderStatus === "processing" || paymentStatus === "paid") {
    fulfillmentStatus = "ordered";
  } else if (
    eligibility === "provider_unavailable" ||
    eligibility === "ineligible" ||
    paymentStatus === "failed"
  ) {
    fulfillmentStatus = "blocked";
  } else if (quoteStatus === "generated") {
    fulfillmentStatus = "ready";
  } else {
    fulfillmentStatus = "not_started";
  }

  return {
    version: "v1",
    eligibility,
    quoteStatus,
    paymentStatus,
    fulfillmentStatus,
    quoteId: asOptionalString(existing.quoteId, 200),
    quoteGeneratedAt,
    quoteExpiresAt,
    checkoutSessionId:
      asOptionalString(existing.checkoutSessionId, 200) ||
      asOptionalString(order?.stripeCheckoutSessionId, 200) ||
      asOptionalString(order?.stripeSessionId, 200),
    checkoutCreatedAt:
      toIsoString(existing.checkoutCreatedAt) ||
      toIsoString(order?.updatedAt) ||
      toIsoString(order?.createdAt),
    paidAt: toIsoString(existing.paidAt) || toIsoString(app?.screeningPaidAt) || toIsoString(order?.paidAt),
    amount:
      typeof input.amount === "number"
        ? input.amount
        : typeof existing.amount === "number"
        ? existing.amount
        : typeof order?.amountTotalCents === "number"
        ? order.amountTotalCents
        : typeof order?.totalAmountCents === "number"
        ? order.totalAmountCents
        : null,
    currency: normalizeCurrency(input.currency) || normalizeCurrency(existing.currency) || normalizeCurrency(order?.currency),
    providerHealthSnapshot: input.providerHealthStatus
      ? { status: input.providerHealthStatus }
      : existing?.providerHealthSnapshot || null,
    lastErrorCode: asOptionalString(existing.lastErrorCode, 120),
    lastErrorMessage: asOptionalString(existing.lastErrorMessage, 500),
    lastUpdatedAt: toIsoString(existing.lastUpdatedAt) || new Date(now).toISOString(),
  };
}

export function buildScreeningMonetizationSummary(
  state: ScreeningMonetizationStateV1
): ScreeningMonetizationSummary {
  let blockingReason: string | null = null;
  if (state.paymentStatus === "paid" || state.fulfillmentStatus === "completed") {
    blockingReason = "SCREENING_ALREADY_PAID";
  } else if (state.fulfillmentStatus === "ordered") {
    blockingReason = "SCREENING_ORDER_ALREADY_CREATED";
  } else if (state.paymentStatus === "checkout_created") {
    blockingReason = "SCREENING_CHECKOUT_ALREADY_EXISTS";
  } else if (state.quoteStatus === "expired") {
    blockingReason = "SCREENING_QUOTE_EXPIRED";
  } else if (state.eligibility === "provider_unavailable") {
    blockingReason = "SCREENING_PROVIDER_UNAVAILABLE";
  } else if (state.eligibility === "requires_upgrade") {
    blockingReason = "SCREENING_UPGRADE_REQUIRED";
  } else if (state.eligibility !== "eligible" || state.fulfillmentStatus === "blocked") {
    blockingReason = state.lastErrorCode || "SCREENING_MONETIZATION_BLOCKED";
  }

  return {
    eligibility: state.eligibility,
    quoteStatus: state.quoteStatus,
    paymentStatus: state.paymentStatus,
    fulfillmentStatus: state.fulfillmentStatus,
    canGenerateQuote:
      !blockingReason ||
      blockingReason === "SCREENING_QUOTE_EXPIRED" ||
      blockingReason === "SCREENING_PROVIDER_UNAVAILABLE",
    canStartCheckout: !blockingReason || blockingReason === "SCREENING_QUOTE_EXPIRED",
    canRetryCheckout:
      state.paymentStatus === "failed" ||
      state.paymentStatus === "abandoned" ||
      state.quoteStatus === "expired",
    alreadyPaid: state.paymentStatus === "paid" || state.fulfillmentStatus === "completed",
    blockingReason,
    amount: state.amount ?? null,
    currency: state.currency ?? null,
  };
}

export function buildScreeningMonetizationPatch(input: {
  current?: any;
  eligibility?: ScreeningMonetizationEligibility;
  quoteStatus?: ScreeningMonetizationQuoteStatus;
  paymentStatus?: ScreeningMonetizationPaymentStatus;
  fulfillmentStatus?: ScreeningMonetizationFulfillmentStatus;
  quoteId?: string | null;
  quoteGeneratedAt?: string | number | Date | null;
  quoteExpiresAt?: string | number | Date | null;
  checkoutSessionId?: string | null;
  checkoutCreatedAt?: string | number | Date | null;
  paidAt?: string | number | Date | null;
  amount?: number | null;
  currency?: string | null;
  providerHealthStatus?: string | null;
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
  now?: number;
}) {
  const now = typeof input.now === "number" ? input.now : Date.now();
  const current = normalizeScreeningMonetizationState({
    application: { screeningMonetization: input.current || {} },
    now,
  });
  const quoteGeneratedAt = toIsoString(input.quoteGeneratedAt) || current.quoteGeneratedAt || null;
  const quoteExpiresAt =
    toIsoString(input.quoteExpiresAt) ||
    (input.quoteStatus === "generated" ? buildQuoteExpiresAt(quoteGeneratedAt) : current.quoteExpiresAt);

  return {
    version: "v1" as const,
    eligibility: input.eligibility || current.eligibility,
    quoteStatus: input.quoteStatus || current.quoteStatus,
    paymentStatus: input.paymentStatus || current.paymentStatus,
    fulfillmentStatus: input.fulfillmentStatus || current.fulfillmentStatus,
    quoteId: input.quoteId === undefined ? current.quoteId || null : input.quoteId,
    quoteGeneratedAt,
    quoteExpiresAt: quoteExpiresAt || null,
    checkoutSessionId:
      input.checkoutSessionId === undefined ? current.checkoutSessionId || null : input.checkoutSessionId,
    checkoutCreatedAt: toIsoString(input.checkoutCreatedAt) || current.checkoutCreatedAt || null,
    paidAt: toIsoString(input.paidAt) || current.paidAt || null,
    amount: typeof input.amount === "number" ? input.amount : current.amount ?? null,
    currency: normalizeCurrency(input.currency) || current.currency || null,
    providerHealthSnapshot: input.providerHealthStatus
      ? { status: input.providerHealthStatus }
      : current.providerHealthSnapshot || null,
    lastErrorCode: input.lastErrorCode === undefined ? current.lastErrorCode || null : input.lastErrorCode,
    lastErrorMessage:
      input.lastErrorMessage === undefined ? current.lastErrorMessage || null : input.lastErrorMessage,
    lastUpdatedAt: new Date(now).toISOString(),
  };
}
