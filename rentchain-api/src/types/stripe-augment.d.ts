import "stripe";

declare module "stripe" {
  namespace Stripe {
    // Widen apiVersion type so older pinned versions are allowed.
    interface StripeConfig {
      apiVersion?: string;
    }
  }
}
