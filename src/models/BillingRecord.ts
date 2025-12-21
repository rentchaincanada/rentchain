export type BillingProvider = "mock" | "singlekey" | "stripe";

export type BillingRecordType =
  | "subscription"
  | "screening_credit"
  | "one_time_fee";

export interface BillingRecord {
  id: string;
  landlordId: string;
  provider: BillingProvider;
  type: BillingRecordType;
  amountCents: number;
  currency: "CAD" | "USD";
  description: string;
  status: "paid" | "pending" | "failed";
  receiptUrl?: string;
  createdAt: string;
}
