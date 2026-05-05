import { Request, Response, Router } from "express";
import Stripe from "stripe";
import { db } from "../config/firebase";
import { getStripeClient } from "../services/stripeService";
import { STRIPE_WEBHOOK_SECRET } from "../config/screeningConfig";
import { stripeNotConfiguredResponse, isStripeNotConfiguredError } from "../lib/stripeNotConfigured";
import { finalizeStripePayment } from "../services/stripeFinalize";
import { applyScreeningResultsFromOrder } from "../services/stripeScreeningProcessor";
import { beginScreening } from "../services/screening/screeningOrchestrator";
import { writeScreeningEvent } from "../services/screening/screeningEvents";
import { recordScreeningPaymentFailed } from "../services/screeningPaymentTransactionService";
import { writeCanonicalEvent } from "../lib/events/buildEvent";
import { buildScreeningMonetizationPatch } from "../services/screening/screeningMonetizationService";
import { recordSystemObservabilityEvent } from "../services/observability/recordSystemObservabilityEvent";
import {
  extractRentPaymentMetadata,
  updateRentPaymentFromWebhook,
} from "../services/rentPayments/rentPaymentService";
import {
  deriveBillingIntervalFromSubscription,
  deriveBillingTierFromSubscription,
  updateLandlordSubscriptionState,
} from "../services/billingSubscriptionSyncService";
import { buildProviderWebhookIdempotencyKey } from "../lib/payments/paymentIdempotency";
import {
  deriveRentPaymentReconciliation,
  normalizeRentPaymentProviderEvent,
} from "../lib/payments/paymentExecutionService";
import type { PaymentIntentReference } from "../lib/payments/paymentTypes";
import { updatePaymentIntentFromProviderSignal } from "../lib/payments/paymentIntents";
import {
  markProviderEventFailed,
  markProviderEventIgnoredDuplicate,
  markProviderEventManualReviewRequired,
  markProviderEventProcessed,
  markProviderEventProcessing,
  markProviderEventReceived,
} from "../lib/payments/paymentProviderEventReceipts";
import { derivePaymentDuplicateSuppressionDecision } from "../lib/payments/paymentDuplicateSuppression";
import { upsertPaymentReconciliationRecord } from "../lib/payments/paymentReconciliationRecords";

interface StripeWebhookRequest extends Request {
  rawBody?: Buffer;
}

const router = Router();

type BillingTier = "starter" | "pro" | "elite";

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
      screeningMonetization: buildScreeningMonetizationPatch({
        current: data?.screeningMonetization,
        eligibility: "eligible",
        paymentStatus: "paid",
        fulfillmentStatus: "ordered",
        checkoutSessionId: sessionId,
        paidAt,
        lastErrorCode: null,
        lastErrorMessage: null,
      }),
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
  await writeCanonicalEvent({
    domain: "screening",
    action: "paid",
    status: "paid",
    actor: {
      type: "system",
      role: "system",
      id: null,
    },
    resource: {
      type: "rental_application",
      id: applicationId,
    },
    occurredAt: paidAt,
    visibility: "internal",
    summary: "Screening payment confirmed",
    metadata: {
      landlordId: data?.landlordId || null,
      stripeEventId: eventId,
      stripeCheckoutSessionId: sessionId,
      stripePaymentIntentId: paymentIntentId || null,
    },
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
    await recordSystemObservabilityEvent(
      {
        eventType: "integration_warning",
        workflow: "screening",
        severity: "warning",
        actorType: "system",
        status: "open",
        title: "Screening webhook missing application context",
        description: "A screening payment webhook arrived without application metadata and could not be applied.",
        safeContext: {
          route: "/api/stripe/webhook",
          actionKey: "screening_webhook_missing_application",
          resourceType: "stripe_event",
          resourceId: eventId,
        },
        idempotencyKey: `screening:webhook_missing_application:${eventId}`,
        occurredAt: paidAt,
      },
      { failSoft: true }
    );
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

function normalizeString(value: unknown, max = 2000): string {
  return String(value || "").trim().slice(0, max);
}

function normalizeOptionalString(value: unknown, max = 2000): string | undefined {
  const next = normalizeString(value, max);
  return next || undefined;
}

function normalizeFailureReason(value: unknown): { code?: string; message?: string } {
  if (!value || typeof value !== "object") return {};
  const item = value as any;
  return {
    code: normalizeOptionalString(item.code, 120),
    message: normalizeOptionalString(item.message || item.reason, 500),
  };
}

function buildExpectedRentPaymentIntent(
  rentPaymentId: string,
  rentPayment: Record<string, unknown> | null | undefined,
  paymentIntentId?: string | null
): PaymentIntentReference | null {
  if (!rentPayment) return null;
  const amount = Number(rentPayment.amountCents);
  return {
    paymentIntentId: normalizeOptionalString(paymentIntentId, 240) || normalizeString(rentPaymentId, 120),
    landlordId: normalizeString(rentPayment.landlordId, 120),
    tenantId: normalizeOptionalString(rentPayment.tenantId, 120) || null,
    propertyId: normalizeOptionalString(rentPayment.propertyId, 120) || null,
    unitId: normalizeOptionalString(rentPayment.unitId, 120) || null,
    leaseId: normalizeOptionalString(rentPayment.leaseId, 120) || null,
    amount: Number.isFinite(amount) ? Math.round(amount) : 0,
    currency: normalizeOptionalString(rentPayment.currency, 8) || "cad",
    purpose: "rent",
    provider: "stripe",
  };
}

function getPaymentIntentIdFromProviderMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  return normalizeOptionalString((metadata as Record<string, unknown>).paymentIntentId, 240) || null;
}

async function prepareRentPaymentWebhookNormalizationContext(params: {
  event: Stripe.Event;
  rentPaymentEvent: ReturnType<typeof extractRentPaymentMetadata>;
}) {
  const { event, rentPaymentEvent } = params;
  try {
    const normalizedProviderEvent = normalizeRentPaymentProviderEvent({
      provider: "stripe",
      rawEvent: event,
      providerEventId: event.id,
      providerPaymentId: rentPaymentEvent.paymentIntentId,
      providerSessionId: rentPaymentEvent.checkoutSessionId,
      purpose: "rent",
    });
    const paymentIntent = await updatePaymentIntentFromProviderSignal({
      paymentIntentId: getPaymentIntentIdFromProviderMetadata(normalizedProviderEvent.metadata),
      rentPaymentId: rentPaymentEvent.rentPaymentId,
      provider: "stripe",
      providerSessionId: normalizedProviderEvent.providerSessionId || rentPaymentEvent.checkoutSessionId,
      providerPaymentId: normalizedProviderEvent.providerPaymentId || rentPaymentEvent.paymentIntentId,
      normalizedStatus: normalizedProviderEvent.normalizedStatus,
    });
    const paymentIntentId =
      paymentIntent?.paymentIntentId || getPaymentIntentIdFromProviderMetadata(normalizedProviderEvent.metadata);
    const idempotencyKey = buildProviderWebhookIdempotencyKey({
      provider: "stripe",
      providerEventId: normalizedProviderEvent.providerEventId || event.id || "event_missing",
    });
    const receipt = await markProviderEventReceived({
      idempotencyKey,
      provider: "stripe",
      providerEventId: normalizedProviderEvent.providerEventId || event.id || "event_missing",
      purpose: "rent",
      subjectType: "rent_payment",
      subjectId: rentPaymentEvent.rentPaymentId,
      paymentIntentId,
      normalizedStatus: normalizedProviderEvent.normalizedStatus,
      rawStatus: normalizedProviderEvent.rawStatus,
      metadata: normalizedProviderEvent.metadata || null,
    });
    const duplicateSuppressionDecision = derivePaymentDuplicateSuppressionDecision({
      receipt: receipt.isDuplicate ? receipt.previousReceipt || receipt.receipt : receipt.receipt,
    });
    await writeCanonicalEvent({
      type: "payment.provider_signal_received",
      domain: "payment",
      action: "provider_signal_received",
      status: normalizedProviderEvent.normalizedStatus,
      actor: {
        type: "system",
        role: "system",
        id: null,
      },
      resource: {
        type: "provider_event_receipt",
        id: receipt.receiptId,
        parentType: "rent_payment",
        parentId: rentPaymentEvent.rentPaymentId,
      },
      occurredAt: typeof event.created === "number" ? event.created * 1000 : new Date().toISOString(),
      visibility: "internal",
      summary: "Payment provider signal received",
      metadata: {
        provider: "stripe",
        providerEventId: normalizedProviderEvent.providerEventId || event.id || "event_missing",
        idempotencyKey,
        receiptId: receipt.receiptId,
        purpose: "rent",
        normalizedStatus: normalizedProviderEvent.normalizedStatus,
        rawStatus: normalizedProviderEvent.rawStatus,
        subjectType: "rent_payment",
        subjectId: rentPaymentEvent.rentPaymentId,
        paymentIntentId: paymentIntentId || null,
      },
    });

    const rentPaymentId = normalizeString(rentPaymentEvent.rentPaymentId, 120);
    const snap = rentPaymentId ? await db.collection("rentPayments").doc(rentPaymentId).get() : null;
    const expectedIntent = snap?.exists
      ? buildExpectedRentPaymentIntent(rentPaymentId, (snap.data() as Record<string, unknown>) || null, paymentIntentId)
      : null;
    const reconciliation = deriveRentPaymentReconciliation({
      expectedIntent,
      providerSignal: normalizedProviderEvent,
    });
    await upsertPaymentReconciliationRecord({
      idempotencyKey,
      receiptId: receipt.receiptId,
      subjectType: "rent_payment",
      subjectId: rentPaymentEvent.rentPaymentId,
      paymentIntentId,
      purpose: "rent",
      providerSignal: normalizedProviderEvent,
      reconciliation,
    });

    if (receipt.isDuplicate) {
      await markProviderEventIgnoredDuplicate({ receiptId: receipt.receiptId });
      return { normalizedProviderEvent, idempotencyKey, reconciliation, receipt, duplicateSuppressionDecision };
    }

    await markProviderEventProcessing({ receiptId: receipt.receiptId });

    if (reconciliation.requiresManualReview) {
      await markProviderEventManualReviewRequired({
        receiptId: receipt.receiptId,
        failureReason: reconciliation.reasons.join(",") || "manual_review_required",
      });
    }

    return { normalizedProviderEvent, idempotencyKey, reconciliation, receipt, duplicateSuppressionDecision };
  } catch (err: any) {
    console.warn("[stripe-webhook-rent-payment] normalization seam skipped", {
      eventId: event.id,
      eventType: event.type,
      rentPaymentId: rentPaymentEvent.rentPaymentId || null,
      message: err?.message || String(err),
    });
    return null;
  }
}

async function markRentPaymentWebhookReceiptProcessed(
  context: Awaited<ReturnType<typeof prepareRentPaymentWebhookNormalizationContext>>
) {
  if (!context?.receipt || context.receipt.isDuplicate) return;
  if (context.reconciliation?.requiresManualReview) return;
  try {
    await markProviderEventProcessed({ receiptId: context.receipt.receiptId });
  } catch (err: any) {
    console.warn("[stripe-webhook-rent-payment] receipt processed marker skipped", {
      receiptId: context.receipt.receiptId,
      message: err?.message || String(err),
    });
  }
}

async function markRentPaymentWebhookReceiptFailed(
  context: Awaited<ReturnType<typeof prepareRentPaymentWebhookNormalizationContext>>,
  err: unknown
) {
  if (!context?.receipt || context.receipt.isDuplicate) return;
  try {
    await markProviderEventFailed({
      receiptId: context.receipt.receiptId,
      failureReason: (err as any)?.message || String(err || "rent_payment_webhook_failed"),
    });
  } catch (markerErr: any) {
    console.warn("[stripe-webhook-rent-payment] receipt failed marker skipped", {
      receiptId: context.receipt.receiptId,
      message: markerErr?.message || String(markerErr),
    });
  }
}

function shouldSuppressRentPaymentWebhookUpdate(
  context: Awaited<ReturnType<typeof prepareRentPaymentWebhookNormalizationContext>>
): boolean {
  return Boolean(
    context?.receipt?.isDuplicate &&
      context.duplicateSuppressionDecision?.shouldSuppress &&
      context.duplicateSuppressionDecision.safeToAcknowledge
  );
}

async function resolveOrderRefFromStripePayment(params: {
  orderId?: string;
  sessionId?: string;
  paymentIntentId?: string;
}) {
  const orderId = normalizeOptionalString(params.orderId, 120);
  if (orderId) return db.collection("screeningOrders").doc(orderId);

  const sessionId = normalizeOptionalString(params.sessionId, 120);
  if (sessionId) {
    const snap = await db.collection("screeningOrders").where("stripeSessionId", "==", sessionId).limit(1).get();
    if (!snap.empty) return snap.docs[0].ref;
  }

  const paymentIntentId = normalizeOptionalString(params.paymentIntentId, 120);
  if (paymentIntentId) {
    const snap = await db.collection("screeningOrders").where("stripePaymentIntentId", "==", paymentIntentId).limit(1).get();
    if (!snap.empty) return snap.docs[0].ref;
  }

  return null;
}

async function handleScreeningPaymentFailure(params: {
  eventId: string;
  eventType: string;
  orderId?: string;
  sessionId?: string;
  paymentIntentId?: string;
  stripeChargeId?: string;
  applicationId?: string;
  landlordId?: string;
  amountTotalCents?: number;
  currency?: string;
  failureCode?: string;
  failureMessage?: string;
  occurredAt: number;
}): Promise<{ ok: boolean; alreadyProcessed: boolean; alreadyFinalized: boolean; orderIdResolved?: string }> {
  const eventId = normalizeString(params.eventId, 120);
  const eventRef = db.collection("stripeEvents").doc(eventId);
  const orderRef = await resolveOrderRefFromStripePayment({
    orderId: params.orderId,
    sessionId: params.sessionId,
    paymentIntentId: params.paymentIntentId,
  });

  if (!orderRef) {
    await eventRef.set(
      {
        createdAt: params.occurredAt,
        type: params.eventType,
        resolved: false,
        outcome: "failed",
        orderId: normalizeOptionalString(params.orderId, 120) || null,
        sessionId: normalizeOptionalString(params.sessionId, 120) || null,
        paymentIntentId: normalizeOptionalString(params.paymentIntentId, 120) || null,
      },
      { merge: true }
    );
    return { ok: false, alreadyProcessed: false, alreadyFinalized: false };
  }

  const result = await db.runTransaction(async (tx) => {
    const existingEvent = await tx.get(eventRef);
    if (existingEvent.exists) {
      return { ok: true, alreadyProcessed: true, alreadyFinalized: true, orderIdResolved: orderRef.id };
    }

    const orderSnap = await tx.get(orderRef);
    if (!orderSnap.exists) {
      tx.set(
        eventRef,
        {
          createdAt: params.occurredAt,
          type: params.eventType,
          resolved: false,
          outcome: "failed",
          orderRef: orderRef.path,
        },
        { merge: true }
      );
      return { ok: false, alreadyProcessed: false, alreadyFinalized: false };
    }

    const order = orderSnap.data() as any;
    const canonicalStatus = String(order?.status || "").toLowerCase();
    const mirroredPaymentStatus = String(order?.paymentStatus || "").toLowerCase();
    const alreadyFinalized =
      Boolean(order?.finalized) || canonicalStatus === "paid" || mirroredPaymentStatus === "paid";
    const applicationId = normalizeOptionalString(params.applicationId, 120) || normalizeOptionalString(order?.applicationId, 120);
    const appRef = applicationId ? db.collection("rentalApplications").doc(applicationId) : null;
    const appSnap = appRef ? await tx.get(appRef) : null;

    tx.set(
      eventRef,
      {
        createdAt: params.occurredAt,
        type: params.eventType,
        resolved: true,
        outcome: "failed",
        orderRef: orderRef.path,
        orderId: orderRef.id,
        sessionId: normalizeOptionalString(params.sessionId, 120) || normalizeOptionalString(order?.stripeSessionId, 120) || null,
        stripeCheckoutSessionId:
          normalizeOptionalString(params.sessionId, 120) ||
          normalizeOptionalString(order?.stripeCheckoutSessionId, 120) ||
          normalizeOptionalString(order?.stripeSessionId, 120) ||
          null,
        paymentIntentId:
          normalizeOptionalString(params.paymentIntentId, 120) || normalizeOptionalString(order?.stripePaymentIntentId, 120) || null,
        stripeChargeId: normalizeOptionalString(params.stripeChargeId, 120) || normalizeOptionalString(order?.stripeChargeId, 120) || null,
      },
      { merge: true }
    );

    if (alreadyFinalized) {
      tx.set(
        orderRef,
        {
          lastStripeEventId: eventId,
          updatedAt: params.occurredAt,
        },
        { merge: true }
      );
      return { ok: true, alreadyProcessed: false, alreadyFinalized: true, orderIdResolved: orderRef.id };
    }

    tx.set(
      orderRef,
      {
        status: "failed",
        paymentStatus: "failed",
        finalized: false,
        lastStripeEventId: eventId,
        stripeSessionId: normalizeOptionalString(params.sessionId, 120) || normalizeOptionalString(order?.stripeSessionId, 120) || null,
        stripeCheckoutSessionId:
          normalizeOptionalString(params.sessionId, 120) ||
          normalizeOptionalString(order?.stripeCheckoutSessionId, 120) ||
          normalizeOptionalString(order?.stripeSessionId, 120) ||
          null,
        stripePaymentIntentId:
          normalizeOptionalString(params.paymentIntentId, 120) || normalizeOptionalString(order?.stripePaymentIntentId, 120) || null,
        stripeChargeId: normalizeOptionalString(params.stripeChargeId, 120) || normalizeOptionalString(order?.stripeChargeId, 120) || null,
        amountTotalCents:
          typeof params.amountTotalCents === "number" ? Math.round(params.amountTotalCents) : order?.amountTotalCents || order?.totalAmountCents || null,
        currency: normalizeOptionalString(params.currency, 8)?.toLowerCase() || order?.currency || null,
        error: {
          code: normalizeOptionalString(params.failureCode, 120) || null,
          message: normalizeOptionalString(params.failureMessage, 500) || null,
        },
        updatedAt: params.occurredAt,
      },
      { merge: true }
    );

    if (appRef && appSnap?.exists) {
      tx.set(
        appRef,
        {
          screening: {
            ...((appSnap.data() as any)?.screening || {}),
            status: "failed",
            failedAt: params.occurredAt,
            orderId: orderRef.id,
            errorCode: normalizeOptionalString(params.failureCode, 120) || null,
          },
          screeningMonetization: buildScreeningMonetizationPatch({
            current: (appSnap.data() as any)?.screeningMonetization,
            eligibility: "eligible",
            paymentStatus: "failed",
            fulfillmentStatus: "blocked",
            checkoutSessionId:
              normalizeOptionalString(params.sessionId, 120) ||
              normalizeOptionalString(order?.stripeCheckoutSessionId, 120) ||
              normalizeOptionalString(order?.stripeSessionId, 120) ||
              null,
            lastErrorCode: "SCREENING_MONETIZATION_BLOCKED",
            lastErrorMessage: normalizeOptionalString(params.failureMessage, 500) || null,
          }),
          updatedAt: params.occurredAt,
        },
        { merge: true }
      );
    }

    return { ok: true, alreadyProcessed: false, alreadyFinalized: false, orderIdResolved: orderRef.id };
  });

  if (result.ok && !result.alreadyProcessed && !result.alreadyFinalized) {
    await recordSystemObservabilityEvent(
      {
        eventType: "action_failed",
        workflow: "screening",
        severity: "warning",
        actorType: "system",
        status: "open",
        title: "Screening payment failed",
        description: "A screening payment failed and the screening workflow is blocked until payment succeeds.",
        safeContext: {
          route: "/api/stripe/webhook",
          actionKey: "screening_payment_failed",
          resourceType: "screening_order",
          resourceId: result.orderIdResolved || orderRef.id,
        },
        idempotencyKey: `screening:payment_failed:${eventId}`,
        occurredAt: params.occurredAt,
      },
      { failSoft: true }
    );
    try {
      const orderSnap = await db.collection("screeningOrders").doc(result.orderIdResolved || orderRef.id).get();
      const order = orderSnap.data() as any;
      await recordScreeningPaymentFailed({
        landlordId: normalizeOptionalString(params.landlordId, 120) || normalizeOptionalString(order?.landlordId, 120) || "",
        propertyId: normalizeOptionalString(order?.propertyId, 120) || null,
        unitId: normalizeOptionalString(order?.unitId, 120) || null,
        applicationId: normalizeOptionalString(params.applicationId, 120) || normalizeOptionalString(order?.applicationId, 120) || null,
        screeningOrderId: result.orderIdResolved || orderRef.id,
        amountCents:
          typeof params.amountTotalCents === "number" ? Math.round(params.amountTotalCents) : Number(order?.amountTotalCents || order?.totalAmountCents || 0),
        currency: normalizeOptionalString(params.currency, 8) || order?.currency || "cad",
        stripeCheckoutSessionId:
          normalizeOptionalString(params.sessionId, 120) || normalizeOptionalString(order?.stripeCheckoutSessionId, 120) || null,
        stripePaymentIntentId: normalizeOptionalString(params.paymentIntentId, 120) || normalizeOptionalString(order?.stripePaymentIntentId, 120) || null,
        stripeChargeId: normalizeOptionalString(params.stripeChargeId, 120) || normalizeOptionalString(order?.stripeChargeId, 120) || null,
        stripeEventId: eventId,
        eventType: params.eventType,
        failureCode: params.failureCode,
        failureMessage: params.failureMessage,
        recordedAt: params.occurredAt,
      });
    } catch (err: any) {
      console.warn("[stripe-webhook-orders] failed to record failed transaction", err?.message || err);
    }
  }

  return result;
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
      const tier = deriveBillingTierFromSubscription(subscription);
      const interval = deriveBillingIntervalFromSubscription(subscription);
      const subscriptionStatus = subscription.status || "unknown";
      const currentPeriodEnd =
        typeof (subscription as any).current_period_end === "number"
          ? (subscription as any).current_period_end * 1000
          : null;

      if (!tier && event.type !== "customer.subscription.deleted") {
        console.warn("[stripe-webhook-subscription] unknown price id", {
          eventId: event.id,
          subscriptionId: subscription.id,
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
      await updateLandlordSubscriptionState({
        landlordId,
        tier: resolvedTier,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscription.id,
        subscriptionStatus,
        subscriptionInterval: resolvedTier === "free" ? null : interval,
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
    event.type === "payment_intent.succeeded" ||
    event.type === "checkout.session.expired"
  ) {
    try {
      const rentPaymentEvent = extractRentPaymentMetadata(event);
      if (rentPaymentEvent.rentPaymentId && rentPaymentEvent.nextStatus) {
        const receiptContext = await prepareRentPaymentWebhookNormalizationContext({ event, rentPaymentEvent });
        if (shouldSuppressRentPaymentWebhookUpdate(receiptContext)) {
          return res.status(200).json({ received: true });
        }
        try {
          await updateRentPaymentFromWebhook({
            rentPaymentId: rentPaymentEvent.rentPaymentId,
            nextStatus: rentPaymentEvent.nextStatus,
            processorCheckoutSessionId: rentPaymentEvent.checkoutSessionId,
            processorPaymentIntentId: rentPaymentEvent.paymentIntentId,
            paidAt: rentPaymentEvent.paidAt,
            eventId: event.id,
          });
          await markRentPaymentWebhookReceiptProcessed(receiptContext);
        } catch (err) {
          await markRentPaymentWebhookReceiptFailed(receiptContext, err);
          throw err;
        }
        return res.status(200).json({ received: true });
      }

      let orderId: string | undefined;
      let sessionId: string | undefined;
      let paymentIntentId: string | undefined;
      let stripeChargeId: string | undefined;
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
        stripeChargeId = typeof pi.latest_charge === "string" ? pi.latest_charge : undefined;
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
        stripeChargeId =
          typeof session.payment_intent === "object" && session.payment_intent
            ? typeof (session.payment_intent as any).latest_charge === "string"
              ? String((session.payment_intent as any).latest_charge)
              : undefined
            : undefined;
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
        stripeChargeId,
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
      } else {
        await recordSystemObservabilityEvent(
          {
            eventType: "workflow_completed",
            workflow: "screening",
            severity: "info",
            actorType: "system",
            status: "resolved",
            title: "Screening completed",
            description: "A screening workflow completed successfully after payment processing.",
            safeContext: {
              route: "/api/stripe/webhook",
              actionKey: "screening_completed",
              resourceType: "screening_order",
              resourceId: resolvedOrderId,
            },
            occurredAt: typeof event.created === "number" ? new Date(event.created * 1000).toISOString() : new Date().toISOString(),
          },
          { failSoft: true }
        );
      }
    } catch (err: any) {
      console.error("[stripe-webhook-orders] handler failed", err?.stack || err);
    }
  }

  if (event.type === "checkout.session.async_payment_failed" || event.type === "payment_intent.payment_failed") {
    try {
      const rentPaymentEvent = extractRentPaymentMetadata(event);
      if (rentPaymentEvent.rentPaymentId && rentPaymentEvent.nextStatus) {
        const receiptContext = await prepareRentPaymentWebhookNormalizationContext({ event, rentPaymentEvent });
        if (shouldSuppressRentPaymentWebhookUpdate(receiptContext)) {
          return res.status(200).json({ received: true });
        }
        try {
          await updateRentPaymentFromWebhook({
            rentPaymentId: rentPaymentEvent.rentPaymentId,
            nextStatus: rentPaymentEvent.nextStatus,
            processorCheckoutSessionId: rentPaymentEvent.checkoutSessionId,
            processorPaymentIntentId: rentPaymentEvent.paymentIntentId,
            paidAt: rentPaymentEvent.paidAt,
            eventId: event.id,
          });
          await markRentPaymentWebhookReceiptProcessed(receiptContext);
        } catch (err) {
          await markRentPaymentWebhookReceiptFailed(receiptContext, err);
          throw err;
        }
        return res.status(200).json({ received: true });
      }

      let orderId: string | undefined;
      let sessionId: string | undefined;
      let paymentIntentId: string | undefined;
      let stripeChargeId: string | undefined;
      let amountTotalCents: number | undefined;
      let currency: string | undefined;
      let landlordId: string | undefined;
      let applicationId: string | undefined;
      let failureCode: string | undefined;
      let failureMessage: string | undefined;

      if (event.type === "payment_intent.payment_failed") {
        const pi = event.data.object as Stripe.PaymentIntent;
        orderId = pi.metadata?.orderId;
        applicationId = pi.metadata?.applicationId;
        landlordId = pi.metadata?.landlordId;
        paymentIntentId = pi.id;
        stripeChargeId = typeof pi.latest_charge === "string" ? pi.latest_charge : undefined;
        amountTotalCents = typeof pi.amount === "number" ? pi.amount : undefined;
        currency = pi.currency || undefined;
        const failure = normalizeFailureReason(pi.last_payment_error);
        failureCode = failure.code;
        failureMessage = failure.message;

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
            // Non-blocking: if lookup fails we still attempt direct order resolution below.
          }
        }
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
        failureCode = normalizeOptionalString((session as any)?.last_payment_error?.code, 120);
        failureMessage =
          normalizeOptionalString((session as any)?.last_payment_error?.message, 500) ||
          normalizeOptionalString((session as any)?.status, 120);
      }

      await handleScreeningPaymentFailure({
        eventId: event.id,
        eventType: event.type,
        orderId,
        sessionId,
        paymentIntentId,
        stripeChargeId,
        applicationId,
        landlordId,
        amountTotalCents,
        currency,
        failureCode,
        failureMessage,
        occurredAt: typeof event.created === "number" ? event.created * 1000 : Date.now(),
      });
    } catch (err: any) {
      console.error("[stripe-webhook-orders] failure handler failed", err?.stack || err);
    }
  }

  return res.status(200).json({ received: true });
};

router.post("/", stripeWebhookHandler);

export default router;

export const __testing = {
  markApplicationScreeningPaid,
  handleScreeningPaidFromSession,
  handleScreeningPaymentFailure,
};
