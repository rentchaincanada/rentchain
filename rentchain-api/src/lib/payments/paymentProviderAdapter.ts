import type {
  PaymentExecutionStatus,
  PaymentIntentReference,
  PaymentProvider,
  PaymentPurpose,
  ProviderPaymentReference,
} from "./paymentTypes";

export type CreatePaymentSessionInput = {
  intent: PaymentIntentReference;
  successUrl?: string | null;
  cancelUrl?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
};

export type CreatePaymentSessionResult = {
  provider: PaymentProvider;
  status: PaymentExecutionStatus;
  redirectUrl?: string | null;
  reference: ProviderPaymentReference;
};

export type NormalizeProviderEventInput = {
  provider: PaymentProvider;
  rawEvent?: unknown;
  providerEventId?: string | null;
  providerPaymentId?: string | null;
  providerSessionId?: string | null;
  providerCustomerId?: string | null;
  rawStatus?: string | null;
  purpose?: PaymentPurpose | null;
  amount?: number | null;
  currency?: string | null;
  occurredAt?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type NormalizedProviderPaymentEvent = {
  provider: PaymentProvider;
  providerEventId?: string | null;
  providerPaymentId?: string | null;
  providerSessionId?: string | null;
  providerCustomerId?: string | null;
  rawStatus: string | null;
  normalizedStatus: PaymentExecutionStatus;
  purpose?: PaymentPurpose | null;
  amount?: number | null;
  currency?: string | null;
  occurredAt?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type PaymentProviderAdapter = {
  provider: PaymentProvider;
  createPaymentSession(input: CreatePaymentSessionInput): Promise<CreatePaymentSessionResult>;
  normalizeProviderEvent(input: NormalizeProviderEventInput): NormalizedProviderPaymentEvent;
  mapProviderStatus(rawStatus: unknown): PaymentExecutionStatus;
};

const STRIPE_STATUS_MAP: Record<string, PaymentExecutionStatus> = {
  open: "provider_session_created",
  complete: "confirmed",
  completed: "confirmed",
  paid: "confirmed",
  succeeded: "confirmed",
  processing: "pending_provider_confirmation",
  requires_payment_method: "pending_provider_confirmation",
  requires_confirmation: "initiated",
  requires_action: "pending_provider_confirmation",
  canceled: "cancelled",
  cancelled: "cancelled",
  expired: "expired",
  failed: "failed",
};

const TRUSTLY_STATUS_MAP: Record<string, PaymentExecutionStatus> = {
  created: "provider_session_created",
  initiated: "initiated",
  pending: "pending_provider_confirmation",
  processing: "pending_provider_confirmation",
  authorized: "pending_settlement",
  settled: "confirmed",
  completed: "confirmed",
  confirmed: "confirmed",
  failed: "failed",
  denied: "failed",
  cancelled: "cancelled",
  canceled: "cancelled",
  expired: "expired",
};

const MANUAL_STATUS_MAP: Record<string, PaymentExecutionStatus> = {
  recorded: "confirmed",
  received: "confirmed",
  reconciled: "reconciled",
  pending: "manual_review_required",
  duplicate: "duplicate_risk",
  void: "cancelled",
  voided: "cancelled",
  failed: "failed",
};

function normalizeRawStatus(rawStatus: unknown): string {
  return String(rawStatus || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

export function mapProviderStatus(provider: PaymentProvider, rawStatus: unknown): PaymentExecutionStatus {
  const status = normalizeRawStatus(rawStatus);
  if (!status) return "manual_review_required";
  const maps: Record<PaymentProvider, Record<string, PaymentExecutionStatus>> = {
    stripe: STRIPE_STATUS_MAP,
    trustly: TRUSTLY_STATUS_MAP,
    manual: MANUAL_STATUS_MAP,
  };
  return maps[provider][status] || "manual_review_required";
}

export function normalizeProviderPaymentEvent(input: NormalizeProviderEventInput): NormalizedProviderPaymentEvent {
  const rawStatus = String(input.rawStatus || "").trim() || null;
  const normalized: NormalizedProviderPaymentEvent = {
    provider: input.provider,
    providerEventId: input.providerEventId || null,
    providerPaymentId: input.providerPaymentId || null,
    providerSessionId: input.providerSessionId || null,
    providerCustomerId: input.providerCustomerId || null,
    rawStatus,
    normalizedStatus: mapProviderStatus(input.provider, rawStatus),
    purpose: input.purpose || null,
    amount: typeof input.amount === "number" && Number.isFinite(input.amount) ? input.amount : null,
    currency: String(input.currency || "").trim().toUpperCase() || null,
    occurredAt: input.occurredAt || null,
  };
  if (input.metadata && typeof input.metadata === "object") {
    normalized.metadata = input.metadata;
  }
  return normalized;
}
