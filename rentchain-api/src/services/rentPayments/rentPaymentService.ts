import crypto from "crypto";
import Stripe from "stripe";
import { db } from "../../config/firebase";
import { FRONTEND_URL } from "../../config/screeningConfig";
import { writeCanonicalEvent } from "../../lib/events/buildEvent";
import { createRentPaymentSession } from "../../lib/payments/paymentExecutionService";
import {
  linkPaymentIntentProviderReference,
  upsertPaymentIntent,
  type PaymentIntentRecord,
} from "../../lib/payments/paymentIntents";
import type { PaymentReadiness } from "../paymentReadiness/derivePaymentReadiness";
import { recordSystemObservabilityEvent } from "../observability/recordSystemObservabilityEvent";

export const RENT_PAYMENTS_COLLECTION = "rentPayments";

export type RentPaymentStatus =
  | "setup_required"
  | "checkout_created"
  | "payment_pending"
  | "paid"
  | "failed"
  | "canceled"
  | "expired";

export type RentPaymentRecord = {
  id: string;
  leaseId: string;
  tenantId: string;
  landlordId: string;
  propertyId?: string | null;
  unitId?: string | null;
  amountCents: number;
  currency: "cad";
  status: RentPaymentStatus;
  processor: "stripe";
  processorCheckoutSessionId?: string | null;
  processorPaymentIntentId?: string | null;
  createdAt: string;
  updatedAt: string;
  paidAt?: string | null;
};

export type RentPaymentSummary = {
  paymentRail: {
    enabled: boolean;
    enabledAt: string | null;
    processor: "stripe" | null;
    blockedReason: string | null;
  };
  latestPayment: {
    id: string;
    amountCents: number;
    currency: "cad";
    status: RentPaymentStatus;
    createdAt: string;
    updatedAt: string;
    paidAt: string | null;
  } | null;
  paymentExperience: {
    history: Array<{
      id: string;
      amountCents: number;
      currency: "cad";
      status: RentPaymentStatus;
      createdAt: string;
      updatedAt: string;
      paidAt: string | null;
    }>;
    latestStatus: "pending" | "paid" | "failed" | "canceled" | null;
    retryAvailable: boolean;
    receiptSummary: {
      available: boolean;
      label: string;
      amountCents: number | null;
      paidAt: string | null;
      leaseReference: string | null;
    };
  };
};

export type RentPaymentEligibility = {
  eligible: boolean;
  blockedReason:
    | "payment_readiness_not_ready"
    | "lease_not_active"
    | "missing_rent_amount"
    | "missing_tenant_link"
    | "invalid_currency"
    | "stripe_not_configured"
    | null;
};

type LeaseLike = {
  id: string;
  landlordId?: string | null;
  tenantId?: string | null;
  tenantIds?: string[] | null;
  primaryTenantId?: string | null;
  propertyId?: string | null;
  unitId?: string | null;
  unitNumber?: string | null;
  monthlyRent?: number | null;
  status?: string | null;
  paymentRailEnabled?: boolean | null;
  paymentRailEnabledAt?: string | null;
  paymentRailProcessor?: string | null;
};

type CreateRentPaymentCheckoutInput = {
  lease: LeaseLike;
  tenantId: string;
  successPath: string;
  cancelPath: string;
};

type UpdateRentPaymentFromWebhookInput = {
  rentPaymentId: string;
  nextStatus: RentPaymentStatus;
  processorCheckoutSessionId?: string | null;
  processorPaymentIntentId?: string | null;
  paidAt?: string | null;
  eventId: string;
};

function asString(value: unknown): string | null {
  const next = String(value || "").trim();
  return next || null;
}

function asNumber(value: unknown): number | null {
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

function toIsoString(value: unknown, fallback = new Date()): string {
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.toISOString();
  }
  return fallback.toISOString();
}

function toMillis(value: unknown): number {
  const iso = toIsoString(value, new Date(0));
  return Date.parse(iso);
}

function resolveFrontendBase(): string {
  const fallback =
    process.env.NODE_ENV === "production" ? "https://www.rentchain.ai" : "http://localhost:5173";
  return String(process.env.FRONTEND_URL || FRONTEND_URL || fallback).trim().replace(/\/$/, "");
}

function sanitizeRelativePath(value: string, fallback: string): string {
  const next = String(value || "").trim();
  if (!next.startsWith("/")) return fallback;
  if (next.startsWith("//")) return fallback;
  if (next.includes("://")) return fallback;
  return next;
}

function normalizeCurrency(value: unknown): "cad" | null {
  const next = String(value || "cad").trim().toLowerCase();
  return next === "cad" ? "cad" : null;
}

function isLeaseStatusEligible(status: unknown): boolean {
  return new Set(["active", "notice_pending", "renewal_pending", "renewal_accepted", "move_out_pending"]).has(
    String(status || "").trim().toLowerCase()
  );
}

function isOpenPaymentStatus(status: RentPaymentStatus): boolean {
  return status === "checkout_created" || status === "payment_pending";
}

function isSameOrMoreFinal(current: RentPaymentStatus, next: RentPaymentStatus): boolean {
  if (current === next) return true;
  if (current === "paid") return true;
  if ((current === "failed" || current === "canceled" || current === "expired") && next !== "paid") return true;
  return false;
}

function summarizePayment(record: RentPaymentRecord | null): RentPaymentSummary["latestPayment"] {
  if (!record) return null;
  return {
    id: record.id,
    amountCents: record.amountCents,
    currency: record.currency,
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    paidAt: record.paidAt || null,
  };
}

export function isRentPaymentRetryAvailable(status: RentPaymentStatus | null | undefined): boolean {
  return status === "failed" || status === "canceled" || status === "expired";
}

export function derivePaymentExperience(
  history: RentPaymentRecord[],
  leaseReference: string
): RentPaymentSummary["paymentExperience"] {
  const items = (history || []).map((record) => summarizePayment(record)).filter(Boolean) as NonNullable<
    RentPaymentSummary["latestPayment"]
  >[];
  const latest = items[0] || null;
  const latestStatus = latest
    ? latest.status === "checkout_created" || latest.status === "payment_pending"
      ? "pending"
      : latest.status === "paid"
      ? "paid"
      : latest.status === "failed"
      ? "failed"
      : "canceled"
    : null;
  const latestPaid = items.find((item) => item.status === "paid") || null;

  return {
    history: items,
    latestStatus,
    retryAvailable: isRentPaymentRetryAvailable(latest?.status || null),
    receiptSummary: {
      available: Boolean(latestPaid),
      label: latestPaid ? "Payment summary available" : "No payment summary available yet",
      amountCents: latestPaid?.amountCents || null,
      paidAt: latestPaid?.paidAt || null,
      leaseReference: latestPaid ? leaseReference : null,
    },
  };
}

function eventSummaryForStatus(status: RentPaymentStatus): string {
  switch (status) {
    case "checkout_created":
      return "Rent payment checkout created";
    case "payment_pending":
      return "Rent payment pending";
    case "paid":
      return "Rent payment confirmed";
    case "failed":
      return "Rent payment failed";
    case "canceled":
      return "Rent payment canceled";
    case "expired":
      return "Rent payment expired";
    default:
      return "Rent payment updated";
  }
}

async function writeRentPaymentEvent(params: {
  leaseId: string;
  tenantId: string;
  landlordId: string;
  rentPaymentId: string;
  status: RentPaymentStatus | "rail_enabled";
  occurredAt?: string;
  actor: {
    type: "tenant" | "landlord" | "system";
    id: string | null;
    role: string | null;
  };
}) {
  const eventType = params.status === "rail_enabled" ? "rent_payment.rail_enabled" : `rent_payment.${params.status}`;
  const action = params.status === "rail_enabled" ? "rail_enabled" : params.status;
  await writeCanonicalEvent({
    type: eventType,
    domain: "billing",
    action,
    status: params.status === "rail_enabled" ? "enabled" : params.status,
    actor: params.actor,
    resource: {
      type: params.status === "rail_enabled" ? "lease" : "rent_payment",
      id: params.status === "rail_enabled" ? params.leaseId : params.rentPaymentId,
    },
    occurredAt: params.occurredAt || new Date().toISOString(),
    visibility: "internal",
    summary: params.status === "rail_enabled" ? "Rent collection enabled" : eventSummaryForStatus(params.status),
    metadata: {
      leaseId: params.leaseId,
      tenantId: params.tenantId,
      landlordId: params.landlordId,
      rentPaymentId: params.status === "rail_enabled" ? null : params.rentPaymentId,
      processor: "stripe",
      status: params.status === "rail_enabled" ? "enabled" : params.status,
    },
  });
}

async function writePaymentIntentEvent(params: {
  type: "payment.intent_created" | "payment.intent_provider_linked";
  paymentIntent: PaymentIntentRecord;
  rentPaymentId: string;
  occurredAt?: string;
}) {
  try {
    await writeCanonicalEvent({
      type: params.type,
      domain: "payment",
      action: params.type.replace(/^payment\./, ""),
      status: params.paymentIntent.status,
      actor: {
        type: "system",
        id: null,
        role: "system",
      },
      resource: {
        type: "payment_intent",
        id: params.paymentIntent.paymentIntentId,
        parentType: "rent_payment",
        parentId: params.rentPaymentId,
      },
      occurredAt: params.occurredAt || new Date().toISOString(),
      visibility: "internal",
      summary:
        params.type === "payment.intent_created"
          ? "Rent PaymentIntent created"
          : "Rent PaymentIntent linked to provider session",
      metadata: {
        paymentIntentId: params.paymentIntent.paymentIntentId,
        rentPaymentId: params.rentPaymentId,
        leaseId: params.paymentIntent.leaseId || null,
        landlordId: params.paymentIntent.landlordId || null,
        tenantId: params.paymentIntent.tenantId || null,
        propertyId: params.paymentIntent.propertyId || null,
        unitId: params.paymentIntent.unitId || null,
        purpose: params.paymentIntent.purpose,
        provider: params.paymentIntent.provider || null,
        providerSessionId: params.paymentIntent.providerSessionId || null,
        providerPaymentId: params.paymentIntent.providerPaymentId || null,
      },
    });
  } catch (err: any) {
    console.warn("[rentPaymentService] payment intent canonical event skipped", {
      type: params.type,
      paymentIntentId: params.paymentIntent.paymentIntentId,
      rentPaymentId: params.rentPaymentId,
      message: err?.message || String(err),
    });
  }
}

async function recordRentPaymentObservabilityEvent(params: {
  rentPaymentId: string;
  status: RentPaymentStatus;
  occurredAt?: string | null;
  actorType: "tenant" | "landlord" | "admin" | "system";
}) {
  if (params.status === "payment_pending") return;

  const titles: Record<RentPaymentStatus, { eventType: any; severity: "info" | "warning"; status?: "resolved" | "open"; title: string; description: string; actionKey: string; }> = {
    setup_required: {
      eventType: "workflow_blocked",
      severity: "warning",
      status: "open",
      title: "Rent payment setup required",
      description: "A rent payment workflow remains blocked until payment setup is completed.",
      actionKey: "rent_payment_setup_required",
    },
    checkout_created: {
      eventType: "workflow_started",
      severity: "info",
      status: "open",
      title: "Rent payment checkout created",
      description: "A rent payment checkout was created and is awaiting processor completion.",
      actionKey: "rent_payment_checkout_created",
    },
    payment_pending: {
      eventType: "workflow_started",
      severity: "info",
      status: "open",
      title: "Rent payment pending",
      description: "A rent payment is waiting for processor confirmation.",
      actionKey: "rent_payment_pending",
    },
    paid: {
      eventType: "workflow_completed",
      severity: "info",
      status: "resolved",
      title: "Rent payment completed",
      description: "A rent payment was confirmed successfully.",
      actionKey: "rent_payment_paid",
    },
    failed: {
      eventType: "action_failed",
      severity: "warning",
      status: "open",
      title: "Rent payment failed",
      description: "A rent payment failed after checkout creation.",
      actionKey: "rent_payment_failed",
    },
    canceled: {
      eventType: "workflow_blocked",
      severity: "warning",
      status: "open",
      title: "Rent payment checkout canceled",
      description: "A rent payment checkout was canceled before completion.",
      actionKey: "rent_payment_canceled",
    },
    expired: {
      eventType: "workflow_blocked",
      severity: "warning",
      status: "open",
      title: "Rent payment checkout expired",
      description: "A rent payment checkout expired before completion.",
      actionKey: "rent_payment_expired",
    },
  };

  const definition = titles[params.status];
  await recordSystemObservabilityEvent(
    {
      eventType: definition.eventType,
      workflow: "payment",
      severity: definition.severity,
      actorType: params.actorType,
      status: definition.status,
      title: definition.title,
      description: definition.description,
      safeContext: {
        actionKey: definition.actionKey,
        resourceType: "rent_payment",
        resourceId: params.rentPaymentId,
      },
      occurredAt: params.occurredAt || new Date().toISOString(),
      source: {
        kind: "system_observability",
      },
    },
    { failSoft: true }
  );
}

export function deriveRentPaymentEligibility(input: {
  lease: LeaseLike;
  paymentReadiness: PaymentReadiness | null | undefined;
  stripeConfigured: boolean;
}): RentPaymentEligibility {
  const lease = input.lease;
  const paymentReadiness = input.paymentReadiness || null;
  if (!input.stripeConfigured) {
    return { eligible: false, blockedReason: "stripe_not_configured" };
  }
  if (paymentReadiness?.readinessStatus !== "ready_to_configure") {
    return { eligible: false, blockedReason: "payment_readiness_not_ready" };
  }
  if (!isLeaseStatusEligible(lease.status)) {
    return { eligible: false, blockedReason: "lease_not_active" };
  }
  if (!(typeof lease.monthlyRent === "number" && lease.monthlyRent > 0)) {
    return { eligible: false, blockedReason: "missing_rent_amount" };
  }
  if (!paymentReadiness.rentTerms.tenantLinked) {
    return { eligible: false, blockedReason: "missing_tenant_link" };
  }
  if (!normalizeCurrency("cad")) {
    return { eligible: false, blockedReason: "invalid_currency" };
  }
  return { eligible: true, blockedReason: null };
}

export async function listRentPaymentsForLease(leaseId: string): Promise<RentPaymentRecord[]> {
  const id = String(leaseId || "").trim();
  if (!id) return [];
  const snap = await db.collection(RENT_PAYMENTS_COLLECTION).where("leaseId", "==", id).get();
  return (snap.docs || [])
    .map((doc: any) => ({ id: doc.id, ...(doc.data() as any) }))
    .sort((a: any, b: any) => {
      const updatedDiff = toMillis(b?.updatedAt) - toMillis(a?.updatedAt);
      if (updatedDiff !== 0) return updatedDiff;
      return toMillis(b?.createdAt) - toMillis(a?.createdAt);
    });
}

export async function getLatestRentPaymentForLease(leaseId: string): Promise<RentPaymentRecord | null> {
  const items = await listRentPaymentsForLease(leaseId);
  return items[0] || null;
}

export async function getRentPaymentSummaryForLease(input: {
  leaseId: string;
  paymentRailEnabled?: boolean | null;
  paymentRailEnabledAt?: string | null;
  paymentRailProcessor?: string | null;
  blockedReason?: string | null;
}): Promise<RentPaymentSummary> {
  const history = await listRentPaymentsForLease(input.leaseId);
  const latestPayment = history[0] || null;
  return {
    paymentRail: {
      enabled: input.paymentRailEnabled === true,
      enabledAt: asString(input.paymentRailEnabledAt),
      processor: input.paymentRailProcessor === "stripe" ? "stripe" : null,
      blockedReason: asString(input.blockedReason),
    },
    latestPayment: summarizePayment(latestPayment),
    paymentExperience: derivePaymentExperience(history, String(input.leaseId || "").trim()),
  };
}

export async function enableRentCollectionForLease(params: {
  leaseId: string;
  tenantId: string;
  landlordId: string;
  actorId: string | null;
}): Promise<{ enabled: true; enabledAt: string; processor: "stripe" }> {
  const enabledAt = new Date().toISOString();
  await db.collection("leases").doc(params.leaseId).set(
    {
      paymentRailEnabled: true,
      paymentRailEnabledAt: enabledAt,
      paymentRailProcessor: "stripe",
    },
    { merge: true }
  );
  await writeRentPaymentEvent({
    leaseId: params.leaseId,
    tenantId: params.tenantId,
    landlordId: params.landlordId,
    rentPaymentId: params.leaseId,
    status: "rail_enabled",
    occurredAt: enabledAt,
    actor: {
      type: "landlord",
      id: params.actorId,
      role: "landlord",
    },
  });
  return { enabled: true, enabledAt, processor: "stripe" };
}

export async function createRentPaymentCheckout(input: CreateRentPaymentCheckoutInput) {
  const lease = input.lease;
  const tenantId = String(input.tenantId || "").trim();
  const landlordId = String(lease.landlordId || "").trim();
  const leaseId = String(lease.id || "").trim();
  const existing = await getLatestRentPaymentForLease(leaseId);
  if (existing && isOpenPaymentStatus(existing.status)) {
    return { ok: false as const, error: "payment_already_pending" };
  }
  if (existing?.status === "paid") {
    return { ok: false as const, error: "payment_already_paid" };
  }

  const amountCents = Math.round((asNumber(lease.monthlyRent) || 0) * 100);
  const rentPaymentId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const checkoutRef = db.collection(RENT_PAYMENTS_COLLECTION).doc(rentPaymentId);
  const frontendBase = resolveFrontendBase();
  const successUrl = `${frontendBase}${sanitizeRelativePath(input.successPath, "/tenant/lease")}`;
  const cancelUrl = `${frontendBase}${sanitizeRelativePath(input.cancelPath, "/tenant/lease")}`;
  const stripeSuccessUrl = `${successUrl}${successUrl.includes("?") ? "&" : "?"}rentPaymentStatus=success`;
  const stripeCancelUrl = `${cancelUrl}${cancelUrl.includes("?") ? "&" : "?"}rentPaymentStatus=canceled`;
  const paymentIntentResult = await upsertPaymentIntent({
    landlordId,
    tenantId,
    propertyId: asString(lease.propertyId),
    unitId: asString(lease.unitId) || asString(lease.unitNumber),
    leaseId,
    rentPaymentId,
    purpose: "rent",
    amountCents,
    currency: "cad",
    source: "rent_payment_checkout",
    provider: "stripe",
    metadataSummary: {
      leaseId,
      rentPaymentId,
      source: "rent_payment_checkout",
    },
    now: createdAt,
  });
  if (paymentIntentResult.created) {
    await writePaymentIntentEvent({
      type: "payment.intent_created",
      paymentIntent: paymentIntentResult.paymentIntent,
      rentPaymentId,
      occurredAt: createdAt,
    });
  }

  const session = await createRentPaymentSession({
    intent: {
      paymentIntentId: paymentIntentResult.paymentIntent.paymentIntentId,
      landlordId,
      tenantId,
      propertyId: asString(lease.propertyId),
      unitId: asString(lease.unitId) || asString(lease.unitNumber),
      leaseId,
      amount: amountCents,
      currency: "cad",
      purpose: "rent",
      provider: "stripe",
    },
    metadata: {
      leaseId,
      tenantId,
      landlordId,
      rentPaymentId,
      paymentIntentId: paymentIntentResult.paymentIntent.paymentIntentId,
    },
    successUrl: stripeSuccessUrl,
    cancelUrl: stripeCancelUrl,
  });
  const linkedPaymentIntent = await linkPaymentIntentProviderReference({
    paymentIntentId: paymentIntentResult.paymentIntent.paymentIntentId,
    provider: "stripe",
    providerSessionId: session.reference.providerSessionId,
    providerPaymentId: session.reference.providerPaymentId,
    status: "provider_session_created",
  });
  if (linkedPaymentIntent) {
    await writePaymentIntentEvent({
      type: "payment.intent_provider_linked",
      paymentIntent: linkedPaymentIntent,
      rentPaymentId,
    });
  }

  const record: RentPaymentRecord = {
    id: rentPaymentId,
    leaseId,
    tenantId,
    landlordId,
    propertyId: asString(lease.propertyId),
    unitId: asString(lease.unitId) || asString(lease.unitNumber),
    amountCents,
    currency: "cad",
    status: "checkout_created",
    processor: "stripe",
    processorCheckoutSessionId: session.reference.providerSessionId,
    processorPaymentIntentId: session.reference.providerPaymentId,
    createdAt,
    updatedAt: createdAt,
    paidAt: null,
  };
  await checkoutRef.set(record, { merge: false });
  await writeRentPaymentEvent({
    leaseId,
    tenantId,
    landlordId,
    rentPaymentId,
    status: "checkout_created",
    occurredAt: createdAt,
    actor: {
      type: "tenant",
      id: tenantId,
      role: "tenant",
    },
  });
  await recordRentPaymentObservabilityEvent({
    rentPaymentId,
    status: "checkout_created",
    occurredAt: createdAt,
    actorType: "tenant",
  });

  return {
    ok: true as const,
    rentPaymentId,
    status: "checkout_created" as const,
    redirectUrl: String(session.redirectUrl || "").trim(),
  };
}

export async function updateRentPaymentFromWebhook(input: UpdateRentPaymentFromWebhookInput) {
  const rentPaymentId = String(input.rentPaymentId || "").trim();
  if (!rentPaymentId) return { handled: false as const, reason: "missing_rent_payment_id" };
  const ref = db.collection(RENT_PAYMENTS_COLLECTION).doc(rentPaymentId);
  const snap = await ref.get();
  if (!snap.exists) return { handled: false as const, reason: "rent_payment_not_found" };

  const current = { id: rentPaymentId, ...(snap.data() as any) } as RentPaymentRecord;
  if (isSameOrMoreFinal(current.status, input.nextStatus)) {
    return { handled: true as const, changed: false as const, record: current };
  }

  const updatedAt = new Date().toISOString();
  const next: Partial<RentPaymentRecord> = {
    status: input.nextStatus,
    updatedAt,
    processorCheckoutSessionId:
      input.processorCheckoutSessionId === undefined ? current.processorCheckoutSessionId || null : input.processorCheckoutSessionId,
    processorPaymentIntentId:
      input.processorPaymentIntentId === undefined ? current.processorPaymentIntentId || null : input.processorPaymentIntentId,
    paidAt: input.nextStatus === "paid" ? asString(input.paidAt) || updatedAt : current.paidAt || null,
  };
  await ref.set(next, { merge: true });

  await writeRentPaymentEvent({
    leaseId: current.leaseId,
    tenantId: current.tenantId,
    landlordId: current.landlordId,
    rentPaymentId: current.id,
    status: input.nextStatus,
    occurredAt: input.paidAt || updatedAt,
    actor: {
      type: "system",
      id: null,
      role: "system",
    },
  });
  await recordRentPaymentObservabilityEvent({
    rentPaymentId: current.id,
    status: input.nextStatus,
    occurredAt: input.paidAt || updatedAt,
    actorType: "system",
  });

  return {
    handled: true as const,
    changed: true as const,
    record: {
      ...current,
      ...next,
    } as RentPaymentRecord,
  };
}

export function extractRentPaymentMetadata(event: Stripe.Event): {
  rentPaymentId: string | null;
  checkoutSessionId: string | null;
  paymentIntentId: string | null;
  nextStatus: RentPaymentStatus | null;
  paidAt: string | null;
} {
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object as Stripe.Checkout.Session;
    return {
      rentPaymentId: asString(session.metadata?.rentPaymentId),
      checkoutSessionId: asString(session.id),
      paymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : null,
      nextStatus:
        event.type === "checkout.session.async_payment_succeeded"
          ? "paid"
          : session.payment_status === "paid" || session.payment_status === "no_payment_required"
          ? "paid"
          : "payment_pending",
      paidAt: typeof event.created === "number" ? new Date(event.created * 1000).toISOString() : null,
    };
  }
  if (event.type === "checkout.session.async_payment_failed") {
    const session = event.data.object as Stripe.Checkout.Session;
    return {
      rentPaymentId: asString(session.metadata?.rentPaymentId),
      checkoutSessionId: asString(session.id),
      paymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : null,
      nextStatus: "failed",
      paidAt: null,
    };
  }
  if (event.type === "payment_intent.succeeded" || event.type === "payment_intent.payment_failed") {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    return {
      rentPaymentId: asString(paymentIntent.metadata?.rentPaymentId),
      checkoutSessionId: null,
      paymentIntentId: asString(paymentIntent.id),
      nextStatus: event.type === "payment_intent.succeeded" ? "paid" : "failed",
      paidAt: typeof event.created === "number" ? new Date(event.created * 1000).toISOString() : null,
    };
  }
  if (event.type === "checkout.session.expired") {
    const session = event.data.object as Stripe.Checkout.Session;
    return {
      rentPaymentId: asString(session.metadata?.rentPaymentId),
      checkoutSessionId: asString(session.id),
      paymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : null,
      nextStatus: "expired",
      paidAt: null,
    };
  }
  return {
    rentPaymentId: null,
    checkoutSessionId: null,
    paymentIntentId: null,
    nextStatus: null,
    paidAt: null,
  };
}
