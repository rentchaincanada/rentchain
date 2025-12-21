import { BillingRecord } from "../../models/BillingRecord";

export interface BillingProviderAdapter {
  createCharge(input: {
    landlordId: string;
    amountCents: number;
    description: string;
    type: BillingRecord["type"];
  }): Promise<BillingRecord>;
}
