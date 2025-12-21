import { MockProvider } from "./providers/MockProvider";
import { BillingRecord } from "../models/BillingRecord";
import { billingStore } from "./billingStore";

const provider = MockProvider;

export async function chargeLandlord(input: {
  landlordId: string;
  amountCents: number;
  description: string;
  type: BillingRecord["type"];
}) {
  const record = await provider.createCharge(input);
  billingStore.insert(record);
  return record;
}

export async function listBillingRecords(landlordId: string) {
  return billingStore.listByLandlord(landlordId);
}
