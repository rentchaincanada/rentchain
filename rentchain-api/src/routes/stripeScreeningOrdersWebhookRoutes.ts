import { Request, Response, Router } from "express";
import Stripe from "stripe";
import { db } from "../config/firebase";
import { getStripeClient } from "../services/stripeService";
import { STRIPE_WEBHOOK_SECRET } from "../config/screeningConfig";
import { stripeNotConfiguredResponse, isStripeNotConfiguredError } from "../lib/stripeNotConfigured";
import { resolvePlanFromPriceId } from "../config/planMatrix";
import { finalizeStripePayment } from "../services/stripeFinalize";
import { applyScreeningResultsFromOrder } from "../services/stripeScreeningProcessor";
import { beginScreening } from "../services/screening/screeningOrchestrator";
import { writeScreeningEvent } from "../services/screening/screeningEvents";

interface StripeWebhookRequest extends Request {
  rawBody?: Buffer;
}

const router = Router();

type BillingTier = "starter" | "pro" | "business";

type ScreeningPaidUpdateStatus = "paid_set" | "already_paid" | "ignored";

async function resolveLandlordIdFromCustomer(
  customerId?: string | null
): Promise<string | null> {
  const id = String(customerId || "").trim();
  if (!id) return null;
  try {
    const snap = await db.collection("landlords").where("stripeCustomerId", "==", id).limit(1).get();
    if (snap.empty) return null;
    return snap.docs[0].id;
  } catch (err) {
    console.warn("[stripe-webhook-subscription] landlord lookup failed", {
      customerId: id,
      err: (err as any)?.message || err,
    });
    return null;
  }
}

async function updateLandlordSubscription(params: {
  landlordId: string;
  tier: BillingTier | "free";
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  subscriptionStatus?: string | null;
  currentPeriodEnd?: number | null;
}) {
  const {
    landlordId,
    tier,
    stripeCustomerId,
    stripeSubscriptionId,
    subscriptionStatus,
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
        subscriptionStatus: subscriptionStatus || null,
        currentPeriodEnd: currentPeriodEnd ?? null,
        subscriptionUpdatedAt: Date.now(),
      },
      { merge: true }
    );
}

async function markApplicationScreeningPaid(params: {
  applicationId: string;
  sessionId: string;
  paymentIntentId?: string;
  paidAt: number;
  eventType: string;
  eventId: string;
}): Promise<ScreeningPaidUpdateStatus> {
  const { applicationId, sessionId, paymentIntentId, paidAt, eventType, eventId } = params;
  const appRef = db.collection("rentalApplications").doc(applicationId);
  const snap = await appRef.get();
  if (!snap.exists) {
    await writeScreeningEvent({
      applicationId,
      landlordId: null,
      type: "webhook_ignored",
      at: paidAt,
      meta: { status: "application_missing", stripeEventId: eventId, sessionId },
      actor: "system",
    });
    console.log("[stripe_webhook]", {
      route: "stripe_webhook",
      eventType,
      eventId,
      applicationId,
      status: "ignored",
    });
    return "ignored";
  }
  const data = snap.data() as any;
  const existingStatus = String(data?.screeningStatus || "").toLowerCase();
  const existingSessionId = String(data?.screeningSessionId || "");
  if (existingStatus === "paid" || (existingSessionId && existingSessionId === sessionId)) {
    await writeScreeningEvent({
      applicationId,
      landlordId: data?.landlordId || null,
      type: "webhook_ignored",
      at: paidAt,
      meta: { status: "already_paid", stripeEventId: eventId, sessionId },
      actor: "system",
    });
    console.log("[stripe_webhook]", {
      route: "stripe_webhook",
      eventType,
      eventId,
      applicationId,
      status: "already_paid",
    });
    return "already_paid";
  }

  await appRef.set(
    {
      screeningStatus: "paid",
      screeningPaidAt: paidAt,
      screeningSessionId: sessionId,
      screeningPaymentIntentId: String(paymentIntentId || ""),
      screeningLastUpdatedAt: paidAt,
    },
    { merge: true }
  );

  await writeScreeningEvent({
    applicationId,
    landlordId: data?.landlordId || null,
    type: "paid",
    at: paidAt,
    meta: { stripeEventId: eventId, sessionId },
    actor: "system",
  });

  console.log("[stripe_webhook]", {
    route: "stripe_webhook",
    eventType,
    eventId,
    applicationId,
    status: "paid_set",
  });
  return "paid_set";
}

async function handleScreeningPaidFromSession(params: {
  session: Stripe.Checkout.Session;
  eventType: string;
  eventId: string;
  paidAt: number;
}): Promise<{ status: ScreeningPaidUpdateStatus; missingApplicationId: boolean }> {
  const { session, eventType, eventId, paidAt } = params;
  const applicationId = session.metadata?.applicationId || session.metadata?.rentalApplicationId;
  if (!applicationId) {
    console.log("[stripe_webhook]", {
      route: "stripe_webhook",
      eventType,
      eventId,
      applicationId: null,
      status: "ignored",
    });
    return { status: "ignored", missingApplicationId: true };
  }

  const status = await markApplicationScreeningPaid({
    applicationId: String(applicationId),
    sessionId: session.id,
    paymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : undefined,
    paidAt,
    eventType,
    eventId,
  });
  if (status === "paid_set") {
    try {
      const begin = await beginScreening(String(applicationId));
      if (!begin.ok && begin.error === "invalid_state") {
        console.log("[stripe_webhook]", {
          route: "stripe_webhook",
          eventType,
          eventId,
          applicationId,
          status: "begin_invalid_state",
        });
      }
    } catch (err: any) {
      console.error("[stripe_webhook] begin screening failed", err?.message || err);
    }
  }
  return { status, missingApplicationId: false };
}

export const stripeWebhookHandler = async (req: StripeWebhookRequest, res: Response) => {
  let stripe: Stripe;
  try {
    stripe = getStripeClient();
  } catch (err) {
    if (isStripeNotConfiguredError(err)) {
      return res.status(400).json(stripeNotConfiguredResponse());
    }
    throw err;
  }
  if (!STRIPE_WEBHOOK_SECRET) {
    return res.status(400).json(stripeNotConfiguredResponse());
  }

  const STRIPE_WEBHOOK_DEBUG = process.env.STRIPE_WEBHOOK_DEBUG === "true";
  const signature = req.headers["stripe-signature"];
  if (STRIPE_WEBHOOK_DEBUG) {
    console.log("[stripe-webhook-orders] raw-body", {
      isBuffer: Buffer.isBuffer(req.body),
      bodyType: typeof req.body,
      bodyLength: Buffer.isBuffer(req.body) ? req.body.length : undefined,
      hasSig: Boolean(req.headers["stripe-signature"]),
    });
  }
  if (!signature) {
    return res.status(400).send("Missing Stripe signature");
  }

  let event: Stripe.Event;
  try {
    // Dashboard whsec_ differs from Stripe CLI whsec_; ensure the sender secret matches Cloud Run.
    const rawBody = req.body as Buffer;
    event = stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    console.error("[stripe-webhook-orders] signature verification failed", err?.message || err);
    return res.status(400).send("Signature verification failed");
  }

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    try {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId =
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer?.id || null;
      const priceId = subscription.items?.data?.[0]?.price?.id || null;
      const tier = resolvePlanFromPriceId(priceId);
      const subscriptionStatus = subscription.status || "unknown";
      const currentPeriodEnd =
        typeof (subscription as any).current_period_end === "number"
          ? (subscription as any).current_period_end * 1000
          : null;

      if (!tier && event.type !== "customer.subscription.deleted") {
        console.warn("[stripe-webhook-subscription] unknown price id", {
          eventId: event.id,
          priceId,
        });
        return res.json({ received: true, ignored: true });
      }

      const metadataLandlordId = String(subscription.metadata?.landlordId || "").trim() || null;
      const landlordId =
        metadataLandlordId || (await resolveLandlordIdFromCustomer(customerId));
      if (!landlordId) {
        console.warn("[stripe-webhook-subscription] landlord not resolved", {
          eventId: event.id,
          customerId,
        });
        return res.json({ received: true, ignored: true });
      }

      const resolvedTier = event.type === "customer.subscription.deleted" ? "free" : tier || "free";
      await updateLandlordSubscription({
        landlordId,
        tier: resolvedTier,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscription.id,
        subscriptionStatus,
        currentPeriodEnd,
      });
      console.log("[stripe-webhook-subscription] updated landlord", {
        eventId: event.id,
        landlordId,
        tier: resolvedTier,
        status: subscriptionStatus,
      });
    } catch (err: any) {
      console.error("[stripe-webhook-subscription] handler failed", err?.message || err);
    }
    return res.json({ received: true });
  }

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded" ||
    event.type === "payment_intent.succeeded"
  ) {
    try {
      let orderId: string | undefined;
      let sessionId: string | undefined;
      let paymentIntentId: string | undefined;
      let amountTotalCents: number | undefined;
      let currency: string | undefined;
      let landlordId: string | undefined;
      let applicationId: string | undefined;

      if (event.type === "payment_intent.succeeded") {
        const pi = event.data.object as Stripe.PaymentIntent;
        orderId = pi.metadata?.orderId;
        applicationId = pi.metadata?.applicationId;
        landlordId = pi.metadata?.landlordId;
        paymentIntentId = pi.id;
        amountTotalCents = typeof pi.amount_received === "number" ? pi.amount_received : undefined;
        currency = pi.currency;

        if (!orderId) {
          try {
            const sessions = await stripe.checkout.sessions.list({
              payment_intent: pi.id,
              limit: 1,
            });
            const s = sessions.data?.[0];
            if (s) {
              sessionId = s.id;
              orderId =
                (s.client_reference_id as string | null) ||
                (s.metadata?.orderId as string | undefined) ||
                undefined;
              applicationId = applicationId || (s.metadata?.applicationId as string | undefined) || undefined;
              landlordId = landlordId || (s.metadata?.landlordId as string | undefined) || undefined;
            }
          } catch {
            // ignore lookup errors; finalize may still work if order already has stripePaymentIntentId
          }
        }

        if (!orderId) {
          console.log("[stripe-webhook-orders] ignore PI event (missing orderId)", {
            eventType: event.type,
            eventId: event.id,
            paymentIntentId: pi.id,
          });
          return res.json({ received: true, ignored: true });
        }

        console.log("[stripe-webhook-orders] PI resolve", {
          eventId: event.id,
          hasOrderId: Boolean(orderId),
          hasSessionId: Boolean(sessionId),
          paymentIntentId: pi.id,
        });
      } else {
        const session = event.data.object as Stripe.Checkout.Session;
        orderId =
          (session.client_reference_id as string | null) ||
          (session.metadata?.orderId as string | undefined);
        applicationId = session.metadata?.applicationId || session.metadata?.rentalApplicationId;
        landlordId = session.metadata?.landlordId;
        sessionId = session.id;
        paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : undefined;
        amountTotalCents = typeof session.amount_total === "number" ? session.amount_total : undefined;
        currency = session.currency || undefined;

        if (event.type === "checkout.session.completed") {
          const paidAt = typeof event.created === "number" ? event.created * 1000 : Date.now();
          const { missingApplicationId } = await handleScreeningPaidFromSession({
            session,
            eventType: event.type,
            eventId: event.id,
            paidAt,
          });
          if (missingApplicationId) {
            return res.json({ received: true, ignored: true });
          }
        }

        if (!orderId) {
          console.log("[stripe-webhook-orders] ignore event (missing orderId)", {
            eventType: event.type,
            eventId: event.id,
            sessionId: session.id,
          });
          return res.json({ received: true, ignored: true });
        }
      }

      console.log("[stripe-webhook-orders] extracted", {
        eventType: event.type,
        eventId: event.id,
        orderId,
        sessionId,
        paymentIntentId,
      });

      const finalize = await finalizeStripePayment({
        eventId: event.id,
        eventType: event.type,
        orderId,
        sessionId,
        paymentIntentId,
        amountTotalCents,
        currency,
        landlordId,
        applicationId,
      });

      console.log("[stripe-webhook-orders] finalize result", finalize);

      if (!finalize.ok) {
        console.error("[stripe-webhook-orders] finalize failed", finalize);
        return res.status(200).json({ received: true });
      }

      if (finalize.alreadyProcessed) {
        return res.status(200).json({ received: true });
      }

      if (finalize.alreadyFinalized) {
        return res.status(200).json({ received: true });
      }

      const resolvedOrderId = finalize.orderIdResolved || orderId;
      const resolvedApplicationId = applicationId;
      if (!resolvedOrderId || !resolvedApplicationId) {
        return res.status(200).json({ received: true });
      }

      const applyResult = await applyScreeningResultsFromOrder({
        orderId: resolvedOrderId,
        applicationId: String(resolvedApplicationId),
      });
      if (!applyResult.ok) {
        console.error("[stripe-webhook-orders] apply results failed", {
          orderId: resolvedOrderId,
          applicationId: resolvedApplicationId,
          error: applyResult.error,
        });
      }
    } catch (err: any) {
      console.error("[stripe-webhook-orders] handler failed", err?.stack || err);
    }
  }

  return res.status(200).json({ received: true });
};

router.post("/", stripeWebhookHandler);

export default router;

export const __testing = {
  markApplicationScreeningPaid,
  handleScreeningPaidFromSession,
};
