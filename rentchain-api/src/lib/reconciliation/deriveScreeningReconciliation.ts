import type { CanonicalEventV1 } from "../events/eventTypes";
import { SCREENING_QUOTE_TTL_MS, normalizeScreeningMonetizationState } from "../../services/screening/screeningMonetizationService";
import type { ScreeningReconciliationStatus, ScreeningReconciliationV1 } from "./reconciliationTypes";

type FinancialTransactionLike = {
  type?: string | null;
  status?: string | null;
  applicationId?: string | null;
  createdAt?: number | null;
  metadata?: Record<string, unknown> | null;
};

type DeriveScreeningReconciliationInput = {
  applicationId: string;
  application?: any;
  latestOrder?: any;
  canonicalEvents?: CanonicalEventV1[];
  financialTransactions?: FinancialTransactionLike[];
  now?: number;
};

type NormalizedEvent = CanonicalEventV1 & {
  __timestampMs: number;
  __timestampIso: string;
};

const CHECKOUT_STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

function asString(value: unknown, max = 240) {
  return String(value || "").trim().slice(0, max);
}

function toIso(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return new Date(value).toISOString();
  const raw = String(value).trim();
  if (!raw) return null;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function toMillis(value: unknown): number | null {
  const iso = toIso(value);
  if (!iso) return null;
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeEvent(event: CanonicalEventV1 | null | undefined): NormalizedEvent | null {
  if (!event) return null;
  const timestampMs = toMillis(event.occurredAt) ?? toMillis(event.recordedAt);
  if (timestampMs == null) return null;
  const resourceType = asString(event.resource?.type, 120);
  const resourceId = asString(event.resource?.id, 240);
  if (!resourceType || !resourceId) return null;
  return {
    ...event,
    __timestampMs: timestampMs,
    __timestampIso: new Date(timestampMs).toISOString(),
  };
}

function sortChronologically(events: NormalizedEvent[]) {
  return [...events].sort((a, b) => {
    if (a.__timestampMs !== b.__timestampMs) return a.__timestampMs - b.__timestampMs;
    return String(a.id || "").localeCompare(String(b.id || ""));
  });
}

function firstEventAt(events: NormalizedEvent[], action: string) {
  return events.find((event) => event.action === action)?.__timestampMs ?? null;
}

function durationBetween(start: number | null, end: number | null) {
  if (start == null || end == null || end < start) return null;
  return end - start;
}

function countByAction(events: NormalizedEvent[]) {
  return events.reduce<Record<string, number>>((acc, event) => {
    const action = asString(event.action, 80).toLowerCase();
    if (!action) return acc;
    acc[action] = (acc[action] || 0) + 1;
    return acc;
  }, {});
}

function extractRelatedScreeningEvents(applicationId: string, events: CanonicalEventV1[]) {
  return sortChronologically(
    events
      .map(normalizeEvent)
      .filter(Boolean)
      .filter((event) => {
        if (!event || event.domain !== "screening") return false;
        const resourceId = asString(event.resource?.id, 240);
        const parentId = asString(event.resource?.parentId, 240);
        const metadataApplicationId = asString(event.metadata?.applicationId, 240);
        return resourceId === applicationId || parentId === applicationId || metadataApplicationId === applicationId;
      }) as NormalizedEvent[]
  );
}

function extractRelatedTransactions(applicationId: string, transactions: FinancialTransactionLike[]) {
  return (transactions || [])
    .filter((tx) => asString(tx.applicationId, 240) === applicationId)
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => asString(value, 240)).filter(Boolean)));
}

function latestMeaningfulTimestamp(params: {
  events: NormalizedEvent[];
  latestOrder?: any;
  monetizationState: ReturnType<typeof normalizeScreeningMonetizationState>;
}) {
  const eventTs = params.events[params.events.length - 1]?.__timestampMs ?? null;
  const orderTs = toMillis(params.latestOrder?.updatedAt) ?? toMillis(params.latestOrder?.createdAt);
  const stateTs =
    toMillis(params.monetizationState.paidAt) ??
    toMillis(params.monetizationState.checkoutCreatedAt) ??
    toMillis(params.monetizationState.quoteGeneratedAt) ??
    toMillis(params.monetizationState.lastUpdatedAt);
  const maxTs = Math.max(eventTs || 0, orderTs || 0, stateTs || 0);
  return maxTs > 0 ? new Date(maxTs).toISOString() : null;
}

function buildReason(
  code: string,
  message: string,
  severity: "info" | "warning" | "blocking"
) {
  return { code, message, severity };
}

export function deriveScreeningReconciliation(
  input: DeriveScreeningReconciliationInput
): ScreeningReconciliationV1 {
  const now = typeof input.now === "number" ? input.now : Date.now();
  const applicationId = asString(input.applicationId, 240);
  const events = extractRelatedScreeningEvents(applicationId, input.canonicalEvents || []);
  const transactions = extractRelatedTransactions(applicationId, input.financialTransactions || []);
  const latestOrder = input.latestOrder || null;
  const monetizationState = normalizeScreeningMonetizationState({
    application: input.application,
    latestOrder,
    now,
  });

  const counts = countByAction(events);
  const quoteCount = counts.quote_generated || 0;
  const checkoutCount = counts.checkout_created || 0;
  const paidCount = counts.paid || 0;
  const completedCount = counts.completed || 0;
  const blockedCount = counts.blocked || 0;

  const paymentInitiatedCount = transactions.filter((tx) => asString(tx.type, 80) === "payment_initiated").length;
  const paymentSucceededCount = transactions.filter((tx) => asString(tx.type, 80) === "payment_succeeded").length;
  const paymentFailedCount = transactions.filter((tx) => asString(tx.type, 80) === "payment_failed").length;

  const hasQuote = quoteCount > 0 || monetizationState.quoteStatus === "generated" || monetizationState.quoteStatus === "expired";
  const hasCheckout =
    checkoutCount > 0 ||
    Boolean(asString(monetizationState.checkoutSessionId, 240)) ||
    Boolean(asString(latestOrder?.stripeCheckoutSessionId || latestOrder?.stripeSessionId, 240));
  const hasExplicitPaidSignal = paidCount > 0 || paymentSucceededCount > 0;
  const hasPaidStateSignal =
    monetizationState.paymentStatus === "paid" || asString(input.application?.screeningStatus, 80).toLowerCase() === "paid";
  const hasPaidEvent = hasExplicitPaidSignal;
  const hasFulfillment =
    completedCount > 0 || monetizationState.fulfillmentStatus === "completed" || asString(input.application?.screeningStatus, 80).toLowerCase() === "complete";
  const hasBlockedEvent =
    blockedCount > 0 ||
    monetizationState.fulfillmentStatus === "blocked" ||
    monetizationState.eligibility === "provider_unavailable" ||
    asString(monetizationState.lastErrorCode, 120) === "SCREENING_PROVIDER_UNAVAILABLE";

  const quoteAt = firstEventAt(events, "quote_generated") ?? toMillis(monetizationState.quoteGeneratedAt);
  const checkoutAt = firstEventAt(events, "checkout_created") ?? toMillis(monetizationState.checkoutCreatedAt);
  const paidAt = firstEventAt(events, "paid") ?? toMillis(monetizationState.paidAt);
  const completedAt = firstEventAt(events, "completed") ?? toMillis(input.application?.screeningCompletedAt);
  const lastMeaningfulEventAt = latestMeaningfulTimestamp({ events, latestOrder, monetizationState });
  const inactivityMs = lastMeaningfulEventAt ? Math.max(0, now - Date.parse(lastMeaningfulEventAt)) : null;

  const quoteIds = uniqueStrings([monetizationState.quoteId]);
  const checkoutIds = uniqueStrings([
    monetizationState.checkoutSessionId,
    latestOrder?.stripeCheckoutSessionId,
    latestOrder?.stripeSessionId,
    ...events
      .map((event) => asString(event.metadata?.stripeCheckoutSessionId, 240) || asString(event.metadata?.sessionId, 240))
      .filter(Boolean),
  ]);
  const screeningOrderIds = uniqueStrings([
    asString(latestOrder?.id, 240),
    ...events
      .filter((event) => asString(event.resource?.type, 120) === "screening_order")
      .map((event) => asString(event.resource?.id, 240)),
    ...transactions
      .map((tx) => asString(tx.metadata?.screeningOrderId, 240))
      .filter(Boolean),
  ]);

  const hasDuplicateRisk =
    checkoutCount > 1 || checkoutIds.length > 1 || screeningOrderIds.length > 1;

  const hasMismatch =
    (hasFulfillment && !hasExplicitPaidSignal) ||
    ((hasPaidStateSignal || monetizationState.fulfillmentStatus === "completed") && !hasExplicitPaidSignal) ||
    (paymentFailedCount > 0 && (hasPaidEvent || hasFulfillment)) ||
    false;

  const reasons: ScreeningReconciliationV1["reasons"] = [];
  let status: ScreeningReconciliationStatus = "not_started";

  if (hasDuplicateRisk) {
    status = "duplicate_risk";
    reasons.push(buildReason("RECON_DUPLICATE_CHECKOUT_RISK", "Multiple screening checkout signals were detected for this application.", "warning"));
  } else if (hasMismatch) {
    status = "mismatch";
    reasons.push(buildReason("RECON_STATE_MISMATCH", "The screening monetization signals are contradictory and need investigation.", "blocking"));
  } else if (hasBlockedEvent) {
    status = "blocked";
    reasons.push(buildReason("RECON_BLOCKED", "The screening monetization flow is explicitly blocked.", "blocking"));
  } else if (hasPaidEvent && hasFulfillment) {
    status = "fulfilled";
    reasons.push(buildReason("RECON_FULFILLED", "Payment and fulfillment signals are both present.", "info"));
  } else if (hasPaidEvent && !hasFulfillment) {
    status = "paid_not_fulfilled";
    reasons.push(buildReason("RECON_PAID_NOT_FULFILLED", "Payment is confirmed but fulfillment has not completed yet.", "warning"));
  } else if (hasCheckout && paymentInitiatedCount > 0 && !hasPaidEvent) {
    status = inactivityMs != null && inactivityMs > CHECKOUT_STALE_THRESHOLD_MS ? "abandoned" : "payment_pending";
    reasons.push(
      status === "payment_pending"
        ? buildReason("RECON_ACTIVE_CHECKOUT", "Checkout is active and payment is still pending confirmation.", "info")
        : buildReason("RECON_ABANDONED_CHECKOUT", "Checkout was created but has gone inactive without payment.", "warning")
    );
  } else if (hasCheckout && !hasPaidEvent) {
    status = inactivityMs != null && inactivityMs > CHECKOUT_STALE_THRESHOLD_MS ? "abandoned" : "checkout_created";
    reasons.push(
      status === "checkout_created"
        ? buildReason("RECON_ACTIVE_CHECKOUT", "Checkout exists and is still within the active window.", "info")
        : buildReason("RECON_ABANDONED_CHECKOUT", "Checkout was created but appears inactive without payment.", "warning")
    );
  } else if (hasQuote && !hasCheckout) {
    const quoteExpired =
      monetizationState.quoteStatus === "expired" ||
      (quoteAt != null && now - quoteAt > SCREENING_QUOTE_TTL_MS);
    if (quoteExpired) {
      status = "expired";
      reasons.push(buildReason("RECON_QUOTE_EXPIRED", "The screening quote expired before checkout started.", "warning"));
    } else {
      status = "quoted";
      reasons.push(buildReason("RECON_QUOTE_ONLY", "A screening quote exists but checkout has not started yet.", "info"));
    }
  } else if (!hasQuote && !hasCheckout && !hasPaidEvent && !hasFulfillment) {
    status = "not_started";
    reasons.push(buildReason("RECON_NOT_STARTED", "No screening monetization activity has started yet.", "info"));
  } else {
    status = "needs_review";
    reasons.push(buildReason("RECON_NEEDS_REVIEW", "The screening monetization flow has incomplete or suspicious signals and needs review.", "warning"));
  }

  return {
    version: "v1",
    applicationId,
    generatedAt: new Date(now).toISOString(),
    status,
    summary: {
      hasQuote,
      hasCheckout,
      hasPaidEvent,
      hasFulfillment,
      hasBlockedEvent,
      hasDuplicateRisk,
      hasMismatch,
      lastMeaningfulEventAt,
    },
    metrics: {
      quoteCount,
      checkoutCount,
      paidCount,
      completedCount,
      blockedCount,
      durationQuoteToCheckoutMs: durationBetween(quoteAt, checkoutAt),
      durationCheckoutToPaidMs: durationBetween(checkoutAt, paidAt),
      durationPaidToCompletedMs: durationBetween(paidAt, completedAt),
      inactivityMs,
    },
    reasons,
    linkedIds: {
      checkoutSessionId: checkoutIds[0] || null,
      screeningOrderId: screeningOrderIds[0] || null,
      quoteId: quoteIds[0] || null,
    },
  };
}
