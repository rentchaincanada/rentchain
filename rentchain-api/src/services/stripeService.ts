import Stripe from "stripe";
import { STRIPE_SECRET_KEY } from "../config/screeningConfig";

let stripeClient: Stripe | null = null;

export function getStripeClient(): Stripe | null {
  if (stripeClient) {
    return stripeClient;
  }

  if (!STRIPE_SECRET_KEY) {
    return null;
  }

  stripeClient = new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: "2024-06-20",
  });

  return stripeClient;
}
