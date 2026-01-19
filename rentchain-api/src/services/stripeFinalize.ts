import { db } from "../config/firebase";
import { enqueueScreeningJob } from "./screeningJobs";

export type FinalizeStripeArgs = {
  eventId: string;
  eventType: string;
  orderId?: string;
  sessionId?: string;
  paymentIntentId?: string;
  amountTotalCents?: number;
  currency?: string;
  applicationId?: string;
  landlordId?: string;
};

export type FinalizeStripeResult =
  | { ok: true; alreadyProcessed: boolean; alreadyFinalized: boolean; orderIdResolved?: string }
  | { ok: false; error: "order_not_found" | "application_not_found" | "unknown"; detail?: string };

function nowMs() {
  return Date.now();
}

function normStr(v: unknown): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s.length ? s : undefined;
}

function normInt(v: unknown): number | undefined {
  if (v == null) return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  return Math.round(n);
}

async function resolveOrderRef(args: FinalizeStripeArgs) {
  const orderId = normStr(args.orderId);
  if (orderId) return db.collection("screeningOrders").doc(orderId);

  const sessionId = normStr(args.sessionId);
  if (sessionId) {
    const snap = await db
      .collection("screeningOrders")
      .where("stripeSessionId", "==", sessionId)
      .limit(1)
      .get();
    if (!snap.empty) return snap.docs[0].ref;
  }

  const pi = normStr(args.paymentIntentId);
  if (pi) {
    const snap = await db
      .collection("screeningOrders")
      .where("stripePaymentIntentId", "==", pi)
      .limit(1)
      .get();
    if (!snap.empty) return snap.docs[0].ref;
  }

  return null;
}

export async function finalizeStripePayment(
  args: FinalizeStripeArgs
): Promise<FinalizeStripeResult> {
  const eventId = normStr(args.eventId);
  if (!eventId) return { ok: false, error: "unknown", detail: "missing eventId" };

  const eventRef = db.collection("stripeEvents").doc(eventId);
  const amountTotalCents = normInt(args.amountTotalCents);
  const currency = normStr(args.currency)?.toLowerCase();

  const orderRef = await resolveOrderRef(args);
  if (!orderRef) {
    await eventRef.set(
      {
        createdAt: nowMs(),
        type: normStr(args.eventType) || "unknown",
        orderId: normStr(args.orderId) || null,
        sessionId: normStr(args.sessionId) || null,
        paymentIntentId: normStr(args.paymentIntentId) || null,
        resolved: false,
      },
      { merge: true }
    );
    return { ok: false, error: "order_not_found" };
  }

  const result = await db.runTransaction(async (tx) => {
    const existingEvent = await tx.get(eventRef);
    const orderSnap = await tx.get(orderRef);
    let order: any = null;
    let alreadyFinalized = false;
    let appRef: FirebaseFirestore.DocumentReference | null = null;
    let appSnap: FirebaseFirestore.DocumentSnapshot | null = null;

    if (existingEvent.exists) {
      return { ok: true, alreadyProcessed: true, alreadyFinalized: true } as FinalizeStripeResult;
    }

    if (!orderSnap.exists) {
      tx.set(
        eventRef,
        {
          createdAt: nowMs(),
          type: normStr(args.eventType) || "unknown",
          orderRef: orderRef.path,
          resolved: false,
        },
        { merge: true }
      );
      return { ok: false, error: "order_not_found" } as FinalizeStripeResult;
    }

    order = orderSnap.data() || {};
    alreadyFinalized = Boolean(order.finalized) || order.paymentStatus === "paid";

    const applicationId = normStr(args.applicationId) || normStr(order.applicationId);
    if (applicationId) {
      appRef = db.collection("rentalApplications").doc(applicationId);
      appSnap = await tx.get(appRef);
    }

    tx.set(
      eventRef,
      {
        createdAt: nowMs(),
        type: normStr(args.eventType) || "unknown",
        resolved: true,
        orderRef: orderRef.path,
        orderId: orderRef.id,
        sessionId: normStr(args.sessionId) || order.stripeSessionId || null,
        paymentIntentId: normStr(args.paymentIntentId) || order.stripePaymentIntentId || null,
      },
      { merge: true }
    );

    if (alreadyFinalized) {
      const patch: any = {
        lastStripeEventId: eventId,
      };
      const pi = normStr(args.paymentIntentId);
      const sid = normStr(args.sessionId);
      if (pi && !order.stripePaymentIntentId) patch.stripePaymentIntentId = pi;
      if (sid && !order.stripeSessionId) patch.stripeSessionId = sid;
      if (currency && !order.currency) patch.currency = currency;
      if (amountTotalCents != null && order.amountTotalCents == null) {
        patch.amountTotalCents = amountTotalCents;
      }

      tx.set(orderRef, patch, { merge: true });

      return {
        ok: true,
        alreadyProcessed: false,
        alreadyFinalized: true,
        orderIdResolved: orderRef.id,
      } as FinalizeStripeResult;
    }

    const finalizedAt = nowMs();
    tx.set(
      orderRef,
      {
        paymentStatus: "paid",
        finalized: true,
        paidAt: finalizedAt,
        finalizedAt,
        lastStripeEventId: eventId,
        stripeSessionId: normStr(args.sessionId) || order.stripeSessionId || null,
        stripePaymentIntentId: normStr(args.paymentIntentId) || order.stripePaymentIntentId || null,
        amountTotalCents: amountTotalCents ?? order.amountTotalCents ?? null,
        currency: currency ?? order.currency ?? null,
        updatedAt: finalizedAt,
      },
      { merge: true }
    );

    if (appRef && appSnap?.exists) {
      tx.set(
        appRef,
        {
          screening: {
            ...(appSnap.data()?.screening || {}),
            status: "paid",
            paidAt: finalizedAt,
            orderId: orderRef.id,
          },
          updatedAt: finalizedAt,
        },
        { merge: true }
      );
    }

    return {
      ok: true,
      alreadyProcessed: false,
      alreadyFinalized: false,
      orderIdResolved: orderRef.id,
    } as FinalizeStripeResult;
  });

  if (result.ok && !result.alreadyFinalized) {
    try {
      let resolvedApplicationId = normStr(args.applicationId);
      let resolvedLandlordId = normStr(args.landlordId);
      if (!resolvedApplicationId || !resolvedLandlordId) {
        const orderSnap = await db.collection("screeningOrders").doc(orderRef.id).get();
        const data = orderSnap.data() as any;
        resolvedApplicationId = resolvedApplicationId || normStr(data?.applicationId);
        resolvedLandlordId = resolvedLandlordId || normStr(data?.landlordId);
      }
      if (resolvedApplicationId) {
        await enqueueScreeningJob({
          orderId: orderRef.id,
          applicationId: resolvedApplicationId,
          landlordId: resolvedLandlordId || null,
          provider: "STUB",
        });
      }
    } catch (err: any) {
      console.warn("[screening-jobs] enqueue failed (non-blocking)", err?.message || err);
    }
  }

  return result;
}
