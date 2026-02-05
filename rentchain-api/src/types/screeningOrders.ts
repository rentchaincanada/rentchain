export type ScreeningOrderStatus =
  | "CREATED"
  | "PAYMENT_PENDING"
  | "PAID"
  | "PROCESSING"
  | "KBA_IN_PROGRESS"
  | "REPORT_READY"
  | "FAILED";

export type ScreeningOrderPaymentStatus = "unpaid" | "paid" | "failed";

export type ScreeningOrder = {
  id: string;
  landlordId: string;
  applicationId?: string | null;
  propertyId?: string | null;
  unitId?: string | null;
  createdAt: number;
  updatedAt?: number | null;
  status: ScreeningOrderStatus;
  paymentStatus: ScreeningOrderPaymentStatus;
  amountCents: number;
  currency: string;
  amountTotalCents?: number | null;
  stripeSessionId?: string | null;
  stripePaymentIntentId?: string | null;
  provider: string;
  providerRequestId?: string | null;
  consent?: {
    name: string;
    consentedAt: number;
    ip?: string | null;
    userAgent?: string | null;
  } | null;
  reportObjectKey?: string | null;
  reportBucket?: string | null;
  failureCode?: string | null;
  failureDetail?: string | null;
  stripeIdentitySessionId?: string | null;
};

export type ScreeningEventType =
  | "order_created"
  | "payment_pending"
  | "payment_succeeded"
  | "consent_created"
  | "kba_in_progress"
  | "kba_failed"
  | "report_ready"
  | "identity_fallback_started";

export type ScreeningEvent = {
  orderId: string;
  landlordId: string | null;
  applicationId?: string | null;
  type: ScreeningEventType;
  at: number;
  meta?: Record<string, any>;
};
