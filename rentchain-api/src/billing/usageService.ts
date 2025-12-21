// Skeleton usage aggregation helpers (non-production).
import { db } from "../firebase";
import type { UsageEvent } from "./subscriptionService";

const USAGE_EVENTS_COLLECTION = "usageEvents";

/**
 * Fetch usage events for the current month for a user.
 * Lightweight helper; replace with proper billing later.
 */
export async function getMonthlyUsageForUser(
  userId: string
): Promise<UsageEvent[]> {
  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const startIso = startOfMonth.toISOString();

  try {
    const snap = await db
      .collection(USAGE_EVENTS_COLLECTION)
      .where("userId", "==", userId)
      .where("timestamp", ">=", startIso)
      .get();

    return snap.docs.map((doc) => doc.data() as UsageEvent);
  } catch (err) {
    console.error("[usageService] getMonthlyUsageForUser error:", err);
    return [];
  }
}
