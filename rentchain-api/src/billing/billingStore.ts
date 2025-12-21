import { BillingRecord } from "../models/BillingRecord";

const store: BillingRecord[] = [];

export const billingStore = {
  insert(record: BillingRecord) {
    store.push(record);
    return record;
  },

  listByLandlord(landlordId: string) {
    return store
      .filter((r) => r.landlordId === landlordId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  },
};
