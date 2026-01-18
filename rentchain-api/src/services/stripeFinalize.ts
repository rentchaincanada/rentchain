import { db } from "../config/firebase";

type FinalizeArgs = {
  eventId: string;
  eventType: string;
  orderId?: string;
  sessionId?: string;
  paymentIntentId?: string;
  amountTotalCents?: number;
  currency?: string;
  landlordId?: string;
  applicationId?: string;
};

type FinalizeResult = {
  ok: boolean;
  alreadyProcessed?: boolean;
  alreadyFinalized?: boolean;
  orderId?: string;
  applicationId?: string | null;
  error?: string;
};

async function markEventProcessed(args: FinalizeArgs): Promise<{ ok: boolean; already: boolean }> {
  const ref = db.collection("stripe_events").doc(String(args.eventId));
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) {
      return { ok: true, already: true };
    }
    tx.set(ref, {
      createdAt: Date.now(),
      type: args.eventType,
      orderId: args.orderId || null,
      paymentIntentId: args.paymentIntentId || null,
      sessionId: args.sessionId || null,
    });
    return { ok: true, already: false };
  });
}

async function resolveOrderDoc(args: FinalizeArgs): Promise<FirebaseFirestore.DocumentSnapshot | null> {
  if (args.orderId) {
    const doc = await db.collection("screeningOrders").doc(String(args.orderId)).get();
    if (doc.exists) return doc;
  }
  if (args.sessionId) {
    const snap = await db
      .collection("screeningOrders")
      .where("stripeSessionId", "==", String(args.sessionId))
      .limit(1)
      .get();
    if (!snap.empty) return snap.docs[0];
  }
  if (args.paymentIntentId) {
    const snap = await db
      .collection("screeningOrders")
      .where("stripePaymentIntentId", "==", String(args.paymentIntentId))
      .limit(1)
      .get();
    if (!snap.empty) return snap.docs[0];
  }
  return null;
}

export async function finalizeStripePayment(args: FinalizeArgs): Promise<FinalizeResult> {
  const eventGate = await markEventProcessed(args);
  if (eventGate.already) {
    return { ok: true, alreadyProcessed: true };
  }

  const orderDoc = await resolveOrderDoc(args);
  if (!orderDoc || !orderDoc.exists) {
    return { ok: false, error: "order_not_found" };
  }

  const orderId = orderDoc.id;
  const orderData = orderDoc.data() as any;
  const applicationId = args.applicationId || orderData?.applicationId || null;
  const now = Date.now();

  const orderRef = db.collection("screeningOrders").doc(orderId);
  const appRef = applicationId ? db.collection("rentalApplications").doc(String(applicationId)) : null;

  const txResult = await db.runTransaction(async (tx) => {
    const freshOrder = await tx.get(orderRef);
    if (!freshOrder.exists) {
      return { ok: false, error: "order_not_found" as const };
    }
    const current = freshOrder.data() as any;
    if (current?.finalized === true || current?.paymentStatus === "paid") {
      return { ok: true, alreadyFinalized: true as const };
    }

    const updates: any = {
      paymentStatus: "paid",
      finalized: true,
      finalizedAt: now,
      paidAt: now,
      lastStripeEventId: args.eventId,
      stripePaymentIntentId: args.paymentIntentId || current?.stripePaymentIntentId || null,
      stripeSessionId: args.sessionId || current?.stripeSessionId || null,
    };

    if (typeof args.amountTotalCents === "number") {
      updates.amountTotalCents = args.amountTotalCents;
    }
    if (args.currency) {
      updates.currency = args.currency;
    }

    tx.set(orderRef, updates, { merge: true });

    if (appRef) {
      tx.set(
        appRef,
        {
          screening: {
            status: "PENDING",
            paymentStatus: "paid",
            paidAt: now,
          },
          updatedAt: now,
        },
        { merge: true }
      );
    }

    return { ok: true, alreadyFinalized: false as const };
  });

  if (!txResult.ok) {
    return { ok: false, error: txResult.error };
  }

  return {
    ok: true,
    alreadyFinalized: txResult.alreadyFinalized,
    orderId,
    applicationId,
  };
}
