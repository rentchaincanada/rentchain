import { v4 as uuid } from "uuid";
import { BillingRecord } from "../types/billing";

const BILLING_RECORDS: BillingRecord[] = [];

export function addRecord(
  partial: Omit<BillingRecord, "id" | "createdAt">
): BillingRecord {
  const record: BillingRecord = {
    id: uuid(),
    createdAt: new Date().toISOString(),
    ...partial,
  };
  BILLING_RECORDS.push(record);
  return record;
}

export function listRecordsForLandlord(landlordId: string): BillingRecord[] {
  return BILLING_RECORDS.filter((r) => r.landlordId === landlordId).sort(
    (a, b) => (a.createdAt < b.createdAt ? 1 : -1)
  );
}

export function getRecord(id: string): BillingRecord | undefined {
  return BILLING_RECORDS.find((r) => r.id === id);
}

export function getAllRecords(): BillingRecord[] {
  return [...BILLING_RECORDS];
}
