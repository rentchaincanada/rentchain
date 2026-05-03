import type Stripe from "stripe";
import { getStripeClient } from "../../../services/stripeService";
import {
  mapProviderStatus as mapProviderExecutionStatus,
  normalizeProviderPaymentEvent,
  type CreatePaymentSessionInput,
  type CreatePaymentSessionResult,
  type NormalizeProviderEventInput,
  type PaymentProviderAdapter,
} from "../paymentProviderAdapter";
import type { PaymentExecutionStatus } from "../paymentTypes";

type StripeCheckoutSessionCreator = (
  params: Stripe.Checkout.SessionCreateParams
) => Promise<Pick<Stripe.Checkout.Session, "id" | "url" | "payment_intent">>;

type StripePaymentProviderOptions = {
  createCheckoutSession?: StripeCheckoutSessionCreator;
};

function resolveCheckoutSessionCreator(options?: StripePaymentProviderOptions): StripeCheckoutSessionCreator {
  if (options?.createCheckoutSession) return options.createCheckoutSession;
  return (params) => getStripeClient().checkout.sessions.create(params);
}

function normalizeStripeCurrency(value: unknown): string {
  return String(value || "cad").trim().toLowerCase() || "cad";
}

function normalizeOptionalString(value: unknown): string | null {
  const next = String(value || "").trim();
  return next || null;
}

function normalizeMetadata(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function normalizeStripeOccurredAt(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return new Date(value * 1000).toISOString();
}

function getStripeObjectId(value: unknown): string | null {
  if (typeof value === "string") return normalizeOptionalString(value);
  if (value && typeof value === "object") {
    return normalizeOptionalString((value as { id?: unknown }).id);
  }
  return null;
}

function deriveCheckoutSessionRawStatus(eventType: string, session: Record<string, unknown>): string | null {
  if (eventType === "checkout.session.async_payment_succeeded") return "paid";
  if (eventType === "checkout.session.async_payment_failed") return "failed";
  if (eventType === "checkout.session.expired") return "expired";
  return normalizeOptionalString(session.payment_status) || normalizeOptionalString(session.status) || eventType || null;
}

function derivePaymentIntentRawStatus(eventType: string, paymentIntent: Record<string, unknown>): string | null {
  if (eventType === "payment_intent.succeeded") return "succeeded";
  if (eventType === "payment_intent.payment_failed") return "failed";
  return normalizeOptionalString(paymentIntent.status) || eventType || null;
}

function normalizeStripeRawEvent(input: NormalizeProviderEventInput): NormalizeProviderEventInput | null {
  const event = input.rawEvent as
    | {
        id?: unknown;
        type?: unknown;
        created?: unknown;
        data?: { object?: Record<string, unknown> };
      }
    | null
    | undefined;
  const eventObject = event?.data?.object;
  if (!event || !eventObject || typeof eventObject !== "object") return null;

  const eventType = String(event.type || "").trim();
  const providerEventId = normalizeOptionalString(event.id) || input.providerEventId || null;
  const occurredAt = normalizeStripeOccurredAt(event.created) || input.occurredAt || null;

  if (eventType.startsWith("checkout.session.")) {
    const paymentIntent = eventObject.payment_intent;
    return {
      ...input,
      provider: "stripe",
      providerEventId,
      providerSessionId: normalizeOptionalString(eventObject.id) || input.providerSessionId || null,
      providerPaymentId: getStripeObjectId(paymentIntent) || input.providerPaymentId || null,
      providerCustomerId: getStripeObjectId(eventObject.customer) || input.providerCustomerId || null,
      rawStatus: deriveCheckoutSessionRawStatus(eventType, eventObject) || input.rawStatus || null,
      amount: typeof eventObject.amount_total === "number" ? eventObject.amount_total : input.amount ?? null,
      currency: normalizeOptionalString(eventObject.currency) || input.currency || null,
      occurredAt,
      metadata: normalizeMetadata(eventObject.metadata) || input.metadata || null,
    };
  }

  if (eventType.startsWith("payment_intent.")) {
    const amount =
      typeof eventObject.amount_received === "number"
        ? eventObject.amount_received
        : typeof eventObject.amount === "number"
          ? eventObject.amount
          : input.amount ?? null;
    return {
      ...input,
      provider: "stripe",
      providerEventId,
      providerPaymentId: normalizeOptionalString(eventObject.id) || input.providerPaymentId || null,
      providerCustomerId: getStripeObjectId(eventObject.customer) || input.providerCustomerId || null,
      rawStatus: derivePaymentIntentRawStatus(eventType, eventObject) || input.rawStatus || null,
      amount,
      currency: normalizeOptionalString(eventObject.currency) || input.currency || null,
      occurredAt,
      metadata: normalizeMetadata(eventObject.metadata) || input.metadata || null,
    };
  }

  return {
    ...input,
    provider: "stripe",
    providerEventId,
    rawStatus: input.rawStatus || eventType || null,
    occurredAt,
  };
}

function buildRentPaymentSessionParams(input: CreatePaymentSessionInput): Stripe.Checkout.SessionCreateParams {
  const intent = input.intent;
  const metadata = {
    leaseId: intent.leaseId || "",
    tenantId: intent.tenantId || "",
    landlordId: intent.landlordId,
    rentPaymentId: intent.paymentIntentId,
    ...(input.metadata || {}),
  };

  return {
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: normalizeStripeCurrency(intent.currency),
          product_data: {
            name: "Monthly rent payment",
          },
          unit_amount: intent.amount,
        },
        quantity: 1,
      },
    ],
    metadata,
    payment_intent_data: {
      metadata,
    },
    success_url: input.successUrl || "",
    cancel_url: input.cancelUrl || "",
  };
}

export function createStripePaymentProvider(options?: StripePaymentProviderOptions): PaymentProviderAdapter {
  const createCheckoutSession = resolveCheckoutSessionCreator(options);

  return {
    provider: "stripe",
    async createPaymentSession(input: CreatePaymentSessionInput): Promise<CreatePaymentSessionResult> {
      if (input.intent.provider !== "stripe") {
        throw new Error("stripe_payment_provider_invalid_provider");
      }
      if (input.intent.purpose !== "rent") {
        throw new Error("stripe_payment_provider_unsupported_purpose");
      }

      const session = await createCheckoutSession(buildRentPaymentSessionParams(input));
      const providerPaymentId = typeof session.payment_intent === "string" ? session.payment_intent : null;

      return {
        provider: "stripe",
        status: "provider_session_created",
        redirectUrl: String(session.url || "").trim(),
        reference: {
          provider: "stripe",
          providerSessionId: session.id,
          providerPaymentId,
          rawStatus: "open",
          normalizedStatus: "provider_session_created",
        },
      };
    },
    normalizeProviderEvent(input: NormalizeProviderEventInput) {
      return normalizeProviderPaymentEvent(normalizeStripeRawEvent(input) || { ...input, provider: "stripe" });
    },
    mapProviderStatus(rawStatus: unknown): PaymentExecutionStatus {
      return mapProviderExecutionStatus("stripe", rawStatus);
    },
  };
}

export const stripePaymentProvider = createStripePaymentProvider();
