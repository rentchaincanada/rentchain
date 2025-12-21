export type BillingRecordStatus = "paid" | "failed";

export interface BillingRecord {
  id: string;
  landlordId: string;
  provider: "stripe";
  kind: "screening_purchase";
  screeningRequestId?: string;
  stripeSessionId: string;
  stripePaymentIntentId?: string | null;
  amountCents: number;
  currency: string;
  createdAt: string;
  status: BillingRecordStatus;
  receiptUrl?: string | null;
  description: string;
}
