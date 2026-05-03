export const PAYMENT_PROVIDERS = ["stripe", "trustly", "manual"] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

export const PAYMENT_PURPOSES = ["rent", "screening", "subscription", "deposit", "maintenance", "payout"] as const;
export type PaymentPurpose = (typeof PAYMENT_PURPOSES)[number];

export const PAYMENT_EXECUTION_STATUSES = [
  "not_started",
  "provider_session_created",
  "initiated",
  "pending_provider_confirmation",
  "pending_settlement",
  "confirmed",
  "failed",
  "cancelled",
  "expired",
  "mismatch",
  "duplicate_risk",
  "manual_review_required",
  "reconciled",
] as const;
export type PaymentExecutionStatus = (typeof PAYMENT_EXECUTION_STATUSES)[number];

export const PAYMENT_ACTOR_TYPES = ["tenant", "landlord", "admin", "system", "provider"] as const;
export type PaymentActorType = (typeof PAYMENT_ACTOR_TYPES)[number];

export type ProviderPaymentReference = {
  provider: PaymentProvider;
  providerPaymentId?: string | null;
  providerSessionId?: string | null;
  providerCustomerId?: string | null;
  providerEventId?: string | null;
  rawStatus?: string | null;
  normalizedStatus?: PaymentExecutionStatus | null;
};

export type PaymentIntentReference = {
  paymentIntentId: string;
  landlordId: string;
  tenantId?: string | null;
  propertyId?: string | null;
  unitId?: string | null;
  leaseId?: string | null;
  screeningOrderId?: string | null;
  subscriptionId?: string | null;
  amount: number;
  currency: string;
  purpose: PaymentPurpose;
  provider: PaymentProvider;
};

export type PaymentSubjectReference = {
  paymentIntentId?: string | null;
  landlordId?: string | null;
  tenantId?: string | null;
  propertyId?: string | null;
  unitId?: string | null;
  leaseId?: string | null;
  screeningOrderId?: string | null;
  subscriptionId?: string | null;
  payoutId?: string | null;
};

export function isPaymentProvider(value: unknown): value is PaymentProvider {
  return (PAYMENT_PROVIDERS as readonly string[]).includes(String(value || "").trim());
}

export function isPaymentPurpose(value: unknown): value is PaymentPurpose {
  return (PAYMENT_PURPOSES as readonly string[]).includes(String(value || "").trim());
}

export function isPaymentExecutionStatus(value: unknown): value is PaymentExecutionStatus {
  return (PAYMENT_EXECUTION_STATUSES as readonly string[]).includes(String(value || "").trim());
}
