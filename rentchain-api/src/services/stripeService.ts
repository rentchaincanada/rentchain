import Stripe from "stripe";

// IMPORTANT:
// - Keep Stripe API version pinned for predictable behavior.
// - Do not silently return null; let callers decide how to respond.
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

// ✅ use Stripe.StripeConfig["apiVersion"] instead of Stripe.LatestApiVersion
export const STRIPE_API_VERSION: Stripe.StripeConfig["apiVersion"] = "2024-06-20";

export function isStripeConfigured(): boolean {
  return Boolean(STRIPE_SECRET_KEY && STRIPE_SECRET_KEY.trim().length > 0);
}

export function getStripeClient(): Stripe {
  if (!isStripeConfigured()) {
    // Throw a predictable error that routes/middleware can map to stripe_not_configured
    const err = new Error("stripe_not_configured");
    (err as any).code = "stripe_not_configured";
    throw err;
  }

  return new Stripe(STRIPE_SECRET_KEY as string, {
    apiVersion: STRIPE_API_VERSION,
  });
}


