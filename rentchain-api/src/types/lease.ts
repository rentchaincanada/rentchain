// src/types/lease.ts

export interface Lease {
  id: string;
  tenantId: string;
  propertyId?: string;
  unitId?: string;

  monthlyRent: number;
  startDate: string;        // YYYY-MM-DD
  endDate: string | null;   // null = ongoing

  status: "active" | "ended" | "pending";

  // e.g. 1 = charge on 1st of each month
  nextChargeDay?: number;

  // Optional notes
  notes?: string;
}
