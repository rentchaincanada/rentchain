// Skeleton subscription service (non-production, Firestore-backed stubs).
import { db } from "../firebase";

export interface Plan {
  id: "free" | "pro" | "enterprise" | string;
  name: string;
  priceMonthly?: number;
  limits?: Record<string, unknown>;
}

export interface Subscription {
  planId: Plan["id"];
  status: "active" | "past_due" | "canceled" | "trialing" | "none";
  renewalDate?: string;
  paymentProvider?: string;
  featuresOverride?: Record<string, unknown>;
}

export interface UsageEvent {
  userId: string;
  type: string;
  timestamp: string;
  cost?: number;
}

const USERS_COLLECTION = "users";
const USAGE_EVENTS_COLLECTION = "usageEvents";

/**
 * Fetch a user's subscription from Firestore.
 * This is a placeholder and not production-ready.
 */
export async function getUserSubscription(
  userId: string
): Promise<Subscription | null> {
  try {
    const doc = await db.collection(USERS_COLLECTION).doc(userId).get();
    const data = doc.data() as { subscription?: Subscription } | undefined;
    return data?.subscription ?? null;
  } catch (err) {
    console.error("[subscriptionService] getUserSubscription error:", err);
    return null;
  }
}

/**
 * Update a user's subscription plan in Firestore.
 * Skeleton only; no billing integration.
 */
export async function setUserSubscription(
  userId: string,
  planId: Plan["id"]
): Promise<Subscription> {
  const subscription: Subscription = {
    planId,
    status: "active",
    paymentProvider: "mock",
    renewalDate: new Date().toISOString(),
    featuresOverride: {},
  };

  try {
    await db.collection(USERS_COLLECTION).doc(userId).set(
      {
        subscription,
      },
      { merge: true }
    );
  } catch (err) {
    console.error("[subscriptionService] setUserSubscription error:", err);
  }

  return subscription;
}

/**
 * Record a usage event (e.g., credit pull).
 * Skeleton only; amounts are not reconciled.
 */
export async function recordUsageEvent(
  userId: string,
  type: string,
  cost?: number
): Promise<void> {
  const event: UsageEvent = {
    userId,
    type,
    timestamp: new Date().toISOString(),
    cost,
  };

  try {
    await db.collection(USAGE_EVENTS_COLLECTION).add(event);
  } catch (err) {
    console.error("[subscriptionService] recordUsageEvent error:", err);
  }
}
