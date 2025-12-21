import { randomUUID } from "crypto";
import { BillingProviderAdapter } from "./BillingProvider";
import { BillingRecord } from "../../models/BillingRecord";

export const MockProvider: BillingProviderAdapter = {
  async createCharge(input): Promise<BillingRecord> {
    return {
      id: randomUUID(),
      landlordId: input.landlordId,
      provider: "mock",
      type: input.type,
      amountCents: input.amountCents,
      currency: "CAD",
      description: input.description,
      status: "paid",
      receiptUrl: `/api/billing/receipts/${randomUUID()}`,
      createdAt: new Date().toISOString(),
    } satisfies BillingRecord;
  },
};
