// src/services/tenantBalanceService.ts
import { firestore } from "../events/firestore";

export interface TenantBalanceSummary {
  tenantId: string;

  // Core math
  totalCharges: number;      // Rent + other debits (RentCharged etc.)
  totalPayments: number;     // Payments applied
  totalAdjustments: number;  // Net adjustments (+/-)
  totalNsfFees: number;      // NSF-related debits
  currentBalance: number;    // charges + nsf + adjustments - payments

  // Helpful UX fields
  lastPaymentDate: string | null;
  lastPaymentAmount: number | null;

  // Optional forecasting (will be more accurate once RentCharged is live)
  nextChargeDate: string | null;   // YYYY-MM-DD if known
  nextChargeAmount: number | null; // if known

  // Raw events count for debugging
  eventCount: number;
}

/**
 * Helper to safely coerce a value to a number or null.
 */
function toNumberOrNull(value: any): number | null {
  if (typeof value === "number") return Number.isNaN(value) ? null : value;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

/**
 * Compute tenant balance from the events collection.
 * This looks at:
 *  - RentCharged (future step C/D, but supported already)
 *  - RentPaymentRecorded
 *  - Adjustment events (type includes "Adjust" and payload.amountDelta)
 *  - RentPaymentFailed (for NSF fee only)
 */
export async function getTenantBalance(
  tenantId: string
): Promise<TenantBalanceSummary> {
  // Load all events for this tenant
  const snap = await firestore
    .collection("events")
    .where("tenantId", "==", tenantId)
    .get();

  let totalCharges = 0;
  let totalPayments = 0;
  let totalAdjustments = 0;
  let totalNsfFees = 0;

  let lastPaymentTs: number | null = null;
  let lastPaymentAmount: number | null = null;

  // For optional "next charge" guess when RentCharged is present
  let latestRentChargeTs: number | null = null;
  let latestRentChargeAmount: number | null = null;

  snap.forEach((doc) => {
    const ev: any = doc.data();
    const type: string = (ev.type || ev.eventType || "").toString();
    const typeLower = type.toLowerCase();
    const payload: any = ev.payload || {};
    const tsRaw = ev.timestamp;

    let ts: number | null = null;
    if (typeof tsRaw === "number") {
      ts = tsRaw;
    } else if (typeof tsRaw === "string") {
      const maybe = Number(tsRaw);
      if (!Number.isNaN(maybe)) {
        ts = maybe;
      } else {
        const parsed = Date.parse(tsRaw);
        ts = Number.isNaN(parsed) ? null : parsed;
      }
    }

    // 1) RentCharged or other charge events
    if (typeLower === "rentcharged") {
      const amount = toNumberOrNull(payload.amount);
      if (amount != null && amount > 0) {
        totalCharges += amount;

        if (ts != null && (latestRentChargeTs == null || ts > latestRentChargeTs)) {
          latestRentChargeTs = ts;
          latestRentChargeAmount = amount;
        }
      }
      return;
    }

    // 2) Successful payments
    if (typeLower === "rentpaymentrecorded") {
      const amount =
        toNumberOrNull(payload.amountPaid ?? payload.amount) ?? 0;

      if (amount > 0) {
        totalPayments += amount;

        if (ts != null && (lastPaymentTs == null || ts > lastPaymentTs)) {
          lastPaymentTs = ts;
          lastPaymentAmount = amount;
        }
      }
      return;
    }

    // 3) Adjustment events (any event with "adjust" in type and amountDelta)
    if (typeLower.includes("adjust")) {
      const delta = toNumberOrNull(payload.amountDelta);
      if (delta != null && delta !== 0) {
        totalAdjustments += delta;
      }
      return;
    }

    // 4) Failed payments / NSF (only adding NSF fee, not attempted amount)
    if (typeLower === "rentpaymentfailed") {
      const nsfFee = toNumberOrNull(payload.nsfFee);
      if (nsfFee != null && nsfFee > 0) {
        totalNsfFees += nsfFee;
      }
      return;
    }

    // Other event types (PAPMandateCreated, AIInsight, etc.) don't affect balance
  });

  const currentBalance =
    totalCharges + totalNsfFees + totalAdjustments - totalPayments;

  // Compute last payment date string
  const lastPaymentDate =
    lastPaymentTs != null
      ? new Date(lastPaymentTs).toISOString().slice(0, 10)
      : null;

  // Simple next charge guess:
  // if we have a RentCharged event, assume monthly and add 1 month
  let nextChargeDate: string | null = null;
  let nextChargeAmount: number | null = null;

  if (latestRentChargeTs != null && latestRentChargeAmount != null) {
    const d = new Date(latestRentChargeTs);
    const next = new Date(d);
    next.setMonth(next.getMonth() + 1);
    nextChargeDate = next.toISOString().slice(0, 10);
    nextChargeAmount = latestRentChargeAmount;
  }

  return {
    tenantId,
    totalCharges,
    totalPayments,
    totalAdjustments,
    totalNsfFees,
    currentBalance,
    lastPaymentDate,
    lastPaymentAmount,
    nextChargeDate,
    nextChargeAmount,
    eventCount: snap.size,
  };
}
