import { Request, Response, Router } from "express";
import Stripe from "stripe";
import { getStripeClient } from "../services/stripeService";
import { STRIPE_WEBHOOK_SECRET } from "../config/screeningConfig";
import { stripeNotConfiguredResponse, isStripeNotConfiguredError } from "../lib/stripeNotConfigured";
import { finalizeStripePayment } from "../services/stripeFinalize";
import { applyScreeningResultsFromOrder } from "../services/stripeScreeningProcessor";

interface StripeWebhookRequest extends Request {
  rawBody?: Buffer;
}

const router = Router();


router.post("/", async (req: StripeWebhookRequest, res: Response) => {
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

  const signature = req.headers["stripe-signature"];
  if (!signature) {
    return res.status(400).send("Missing Stripe signature");
  }

  let event: Stripe.Event;
  try {
    const rawBody = req.body as Buffer;
    event = stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    console.error("[stripe-webhook-orders] signature verification failed", err?.message || err);
    return res.status(400).send("Signature verification failed");
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
        applicationId = session.metadata?.applicationId;
        landlordId = session.metadata?.landlordId;
        sessionId = session.id;
        paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : undefined;
        amountTotalCents = typeof session.amount_total === "number" ? session.amount_total : undefined;
        currency = session.currency || undefined;
      }

      console.log("[stripe-webhook-orders] extracted", {
        eventType: event.type,
        eventId: event.id,
        orderId,
        sessionId,
        paymentIntentId,
        applicationId,
        landlordId,
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

      if (!finalize.ok) {
        console.error("[stripe-webhook-orders] finalize failed", {
          eventId: event.id,
          eventType: event.type,
          orderId,
          sessionId,
          paymentIntentId,
          error: finalize.error,
        });
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
      console.error("[stripe-webhook-orders] handler failed", err?.message || err);
    }
  }

  return res.status(200).json({ received: true });
});

export default router;
