// BACKEND: rentchain-api/src/models/lease.ts

export type LeaseStatus = "active" | "ended" | "pending";

export interface LeaseInput {
  tenantId: string;
  propertyId: string;
  unitId: string;
  startDate: string;          // ISO date string
  endDate?: string | null;    // ISO date string or null
  rent: number;
  status?: LeaseStatus;       // default: "active"
}

export interface LeaseRecord extends LeaseInput {
  id: string;
  status: LeaseStatus;
  createdAt: string;
  updatedAt: string;
}
