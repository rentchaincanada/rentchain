import Stripe from "stripe";
import { db } from "../firebase";
import { resolvePlanFromPriceId, resolvePaidBillingPlan } from "../config/planMatrix";

export type BillingTier = "starter" | "pro" | "elite";
export type BillingInterval = "monthly" | "yearly";

export function normalizeBillingInterval(input: unknown): BillingInterval | null {
  const raw = String(input || "").trim().toLowerCase();
  if (raw === "month" || raw === "monthly") return "monthly";
  if (raw === "year" || raw === "yearly" || raw === "annual" || raw === "annually") return "yearly";
  return null;
}

export function isVerifiedPaidSession(status: unknown, paymentStatus: unknown): boolean {
  const normalizedStatus = String(status || "").trim().toLowerCase();
  const normalizedPaymentStatus = String(paymentStatus || "").trim().toLowerCase();
  if (normalizedStatus !== "complete") return false;
  return normalizedPaymentStatus === "paid" || normalizedPaymentStatus === "no_payment_required";
}

export function deriveBillingTierFromSubscription(subscription: Stripe.Subscription): BillingTier | null {
  const priceId = subscription.items?.data?.[0]?.price?.id || null;
  return resolvePaidBillingPlan(subscription.metadata?.tier) || resolvePlanFromPriceId(priceId);
}

export function deriveBillingTierFromCheckoutSession(session: Stripe.Checkout.Session): BillingTier | null {
  const subscription =
    session.subscription && typeof session.subscription === "object" ? (session.subscription as Stripe.Subscription) : null;
  const priceId = subscription?.items?.data?.[0]?.price?.id || null;
  return (
    resolvePaidBillingPlan(session.metadata?.tier) ||
    resolvePaidBillingPlan(subscription?.metadata?.tier) ||
    resolvePlanFromPriceId(priceId)
  );
}

export function deriveBillingIntervalFromSubscription(subscription: Stripe.Subscription): BillingInterval | null {
  return (
    normalizeBillingInterval(subscription.metadata?.interval) ||
    normalizeBillingInterval(subscription.items?.data?.[0]?.price?.recurring?.interval)
  );
}

export function deriveBillingIntervalFromCheckoutSession(session: Stripe.Checkout.Session): BillingInterval | null {
  const subscription =
    session.subscription && typeof session.subscription === "object" ? (session.subscription as Stripe.Subscription) : null;
  return (
    normalizeBillingInterval(session.metadata?.interval) ||
    normalizeBillingInterval(subscription?.metadata?.interval) ||
    normalizeBillingInterval(subscription?.items?.data?.[0]?.price?.recurring?.interval)
  );
}

export async function updateLandlordSubscriptionState(params: {
  landlordId: string;
  tier: BillingTier | "free";
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripeCheckoutSessionId?: string | null;
  subscriptionStatus?: string | null;
  subscriptionInterval?: BillingInterval | null;
  currentPeriodEnd?: number | null;
}) {
  const {
    landlordId,
    tier,
    stripeCustomerId,
    stripeSubscriptionId,
    stripeCheckoutSessionId,
    subscriptionStatus,
    subscriptionInterval,
    currentPeriodEnd,
  } = params;

  await db
    .collection("landlords")
    .doc(landlordId)
    .set(
      {
        plan: tier,
        stripeCustomerId: stripeCustomerId || null,
        stripeSubscriptionId: stripeSubscriptionId || null,
        stripeCheckoutSessionId: stripeCheckoutSessionId || null,
        subscriptionStatus: subscriptionStatus || null,
        subscriptionInterval: subscriptionInterval || null,
        currentPeriodEnd: currentPeriodEnd ?? null,
        subscriptionUpdatedAt: Date.now(),
      },
      { merge: true }
    );
}

