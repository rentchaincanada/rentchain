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
      return normalizeProviderPaymentEvent({ ...input, provider: "stripe" });
    },
    mapProviderStatus(rawStatus: unknown): PaymentExecutionStatus {
      return mapProviderExecutionStatus("stripe", rawStatus);
    },
  };
}

export const stripePaymentProvider = createStripePaymentProvider();
