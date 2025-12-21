import { MockProvider } from "./providers/MockProvider";
import { BillingRecord } from "../models/BillingRecord";

const provider = MockProvider;

type Store = {
  records: BillingRecord[];
};

const store: Store =
  (globalThis as any).__billingStore ||
  ((globalThis as any).__billingStore = { records: [] });

export async function chargeLandlord(input: {
  landlordId: string;
  amountCents: number;
  description: string;
  type: BillingRecord["type"];
}) {
  const record = await provider.createCharge(input);
  store.records.push(record);
  return record;
}

export async function listBillingRecords(landlordId: string) {
  return store.records.filter((r) => r.landlordId === landlordId);
}

export async function getBillingRecord(id: string) {
  return store.records.find((r) => r.id === id);
}
