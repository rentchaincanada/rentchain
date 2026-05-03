import { derivePaymentReconciliation } from "./paymentReconciliation";
import type { NormalizedProviderPaymentEvent, NormalizeProviderEventInput, PaymentProviderAdapter } from "./paymentProviderAdapter";
import { stripePaymentProvider } from "./providers/stripePaymentProvider";
import type { PaymentIntentReference, PaymentProvider } from "./paymentTypes";

type PaymentExecutionAdapters = Partial<Record<PaymentProvider, PaymentProviderAdapter>>;

export type RentPaymentSessionInput = {
  intent: PaymentIntentReference;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export function createPaymentExecutionService(adapters: PaymentExecutionAdapters = { stripe: stripePaymentProvider }) {
  function getAdapter(provider: PaymentProvider): PaymentProviderAdapter {
    const adapter = adapters[provider];
    if (!adapter || provider !== "stripe") {
      throw new Error("payment_provider_unsupported");
    }
    return adapter;
  }

  return {
    async createRentPaymentSession(input: RentPaymentSessionInput) {
      if (input.intent.provider !== "stripe") {
        throw new Error("payment_provider_unsupported");
      }
      if (input.intent.purpose !== "rent") {
        throw new Error("payment_purpose_unsupported");
      }
      return getAdapter(input.intent.provider).createPaymentSession(input);
    },

    normalizeRentPaymentProviderEvent(input: NormalizeProviderEventInput): NormalizedProviderPaymentEvent {
      if (input.provider !== "stripe") {
        throw new Error("payment_provider_unsupported");
      }
      return getAdapter(input.provider).normalizeProviderEvent(input);
    },

    deriveRentPaymentReconciliation(input: Parameters<typeof derivePaymentReconciliation>[0]) {
      return derivePaymentReconciliation(input);
    },
  };
}

export const paymentExecutionService = createPaymentExecutionService();

export const createRentPaymentSession = paymentExecutionService.createRentPaymentSession;
export const normalizeRentPaymentProviderEvent = paymentExecutionService.normalizeRentPaymentProviderEvent;
export const deriveRentPaymentReconciliation = paymentExecutionService.deriveRentPaymentReconciliation;
