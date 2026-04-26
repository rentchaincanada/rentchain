import { createTransaction } from "./financialTransactionService";

type ScreeningPaymentTransactionContext = {
  landlordId: string;
  propertyId?: string | null;
  unitId?: string | null;
  tenantId?: string | null;
  applicationId?: string | null;
  screeningOrderId: string;
  amountCents: number;
  currency?: string | null;
  stripeCheckoutSessionId?: string | null;
  stripePaymentIntentId?: string | null;
  stripeChargeId?: string | null;
  stripeEventId?: string | null;
  eventType?: string | null;
  serviceLevel?: string | null;
  failureCode?: string | null;
  failureMessage?: string | null;
  recordedAt?: number;
};

function asString(value: unknown, max = 2000): string {
  return String(value || "").trim().slice(0, max);
}

function asOptionalString(value: unknown, max = 2000): string | undefined {
  const next = asString(value, max);
  return next || undefined;
}

function normalizeCurrency(value: unknown) {
  const next = asString(value, 8).toUpperCase();
  return /^[A-Z]{3}$/.test(next) ? next : "CAD";
}

function buildTransactionId(prefix: string, key: string) {
  return `${prefix}_${String(key || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 160)}`;
}

export async function recordScreeningPaymentInitiated(context: ScreeningPaymentTransactionContext) {
  const screeningOrderId = asString(context.screeningOrderId, 120);
  const recordedAt = typeof context.recordedAt === "number" ? context.recordedAt : Date.now();
  return createTransaction({
    id: buildTransactionId("payment_initiated", screeningOrderId),
    landlordId: asString(context.landlordId, 120),
    propertyId: asOptionalString(context.propertyId, 120),
    unitId: asOptionalString(context.unitId, 120),
    tenantId: asOptionalString(context.tenantId, 120),
    applicationId: asOptionalString(context.applicationId, 120),
    type: "payment_initiated",
    amountCents: Number(context.amountCents || 0),
    currency: normalizeCurrency(context.currency),
    status: "pending",
    metadata: {
      paymentRail: "stripe_checkout",
      screeningOrderId,
      stripeCheckoutSessionId: asOptionalString(context.stripeCheckoutSessionId, 120),
      stripePaymentIntentId: asOptionalString(context.stripePaymentIntentId, 120),
      serviceLevel: asOptionalString(context.serviceLevel, 80),
    },
    createdAt: recordedAt,
    updatedAt: recordedAt,
  });
}

export async function recordScreeningPaymentSucceeded(context: ScreeningPaymentTransactionContext) {
  const key = asOptionalString(context.stripeEventId, 120) || asString(context.screeningOrderId, 120);
  const recordedAt = typeof context.recordedAt === "number" ? context.recordedAt : Date.now();
  return createTransaction({
    id: buildTransactionId("payment_succeeded", key),
    landlordId: asString(context.landlordId, 120),
    propertyId: asOptionalString(context.propertyId, 120),
    unitId: asOptionalString(context.unitId, 120),
    tenantId: asOptionalString(context.tenantId, 120),
    applicationId: asOptionalString(context.applicationId, 120),
    type: "payment_succeeded",
    amountCents: Number(context.amountCents || 0),
    currency: normalizeCurrency(context.currency),
    status: "completed",
    metadata: {
      paymentRail: "stripe_checkout",
      screeningOrderId: asString(context.screeningOrderId, 120),
      stripeCheckoutSessionId: asOptionalString(context.stripeCheckoutSessionId, 120),
      stripePaymentIntentId: asOptionalString(context.stripePaymentIntentId, 120),
      stripeChargeId: asOptionalString(context.stripeChargeId, 120),
      stripeEventId: asOptionalString(context.stripeEventId, 120),
      stripeEventType: asOptionalString(context.eventType, 120),
    },
    createdAt: recordedAt,
    updatedAt: recordedAt,
  });
}

export async function recordScreeningPaymentFailed(context: ScreeningPaymentTransactionContext) {
  const key = asOptionalString(context.stripeEventId, 120) || asString(context.screeningOrderId, 120);
  const recordedAt = typeof context.recordedAt === "number" ? context.recordedAt : Date.now();
  return createTransaction({
    id: buildTransactionId("payment_failed", key),
    landlordId: asString(context.landlordId, 120),
    propertyId: asOptionalString(context.propertyId, 120),
    unitId: asOptionalString(context.unitId, 120),
    tenantId: asOptionalString(context.tenantId, 120),
    applicationId: asOptionalString(context.applicationId, 120),
    type: "payment_failed",
    amountCents: Number(context.amountCents || 0),
    currency: normalizeCurrency(context.currency),
    status: "failed",
    metadata: {
      paymentRail: "stripe_checkout",
      screeningOrderId: asString(context.screeningOrderId, 120),
      stripeCheckoutSessionId: asOptionalString(context.stripeCheckoutSessionId, 120),
      stripePaymentIntentId: asOptionalString(context.stripePaymentIntentId, 120),
      stripeChargeId: asOptionalString(context.stripeChargeId, 120),
      stripeEventId: asOptionalString(context.stripeEventId, 120),
      stripeEventType: asOptionalString(context.eventType, 120),
      failureCode: asOptionalString(context.failureCode, 120),
      failureMessage: asOptionalString(context.failureMessage, 500),
    },
    createdAt: recordedAt,
    updatedAt: recordedAt,
  });
}
