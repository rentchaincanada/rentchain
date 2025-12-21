// src/events/financial/RentPaymentRecorded.ts
import { LedgerEvent } from "../envelope";

export interface RentPaymentRecordedData {
  tenantId: string;
  propertyId: string;
  unitId: string;
  monthlyRent: number;
  amountPaid: number;
  dueDate: string;     // ISO date string
  paidAt: string;      // ISO date string
  notes?: string;
}

export type RentPaymentRecordedEvent = LedgerEvent<RentPaymentRecordedData>;
