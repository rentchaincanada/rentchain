export type BillingRecordStatus = "paid" | "failed";

export interface BillingRecord {
  id: string;
  landlordId: string;
  provider: "stripe";
  kind: "screening_purchase";
  screeningRequestId?: string;
  screeningTier?: "basic" | "verify" | "verify_ai";
  screeningPackage?: "basic" | "standard" | "premium";
  addons?: string[];
  paymentResponsibility?: "landlord" | "tenant";
  stripeSessionId: string;
  stripePaymentIntentId?: string | null;
  amountCents: number;
  totalAmountCents?: number;
  currency: string;
  createdAt: string;
  status: BillingRecordStatus;
  receiptUrl?: string | null;
  description: string;
}
