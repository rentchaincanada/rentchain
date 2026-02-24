// BACKEND: rentchain-api/src/models/lease.ts

export type LeaseStatus = "active" | "ended" | "pending";
export type LeaseRenewalStatus = "unknown" | "offered" | "accepted" | "declined";

export interface LeaseInput {
  tenantId: string;
  propertyId: string;
  unitId: string;
  startDate: string;          // ISO date string
  endDate?: string | null;    // ISO date string or null
  rent: number;
  status?: LeaseStatus;       // default: "active"
  automationEnabled?: boolean; // default: true
  renewalStatus?: LeaseRenewalStatus; // default: "unknown"
}

export interface LeaseRecord extends LeaseInput {
  id: string;
  status: LeaseStatus;
  automationEnabled: boolean;
  renewalStatus: LeaseRenewalStatus;
  createdAt: string;
  updatedAt: string;
}
