import crypto from "crypto";

export type LeaseStatus = "active" | "ended";

export interface Lease {
  id: string;
  tenantId: string;
  propertyId: string;
  unitNumber: string;
  monthlyRent: number;
  startDate: string;
  endDate?: string;
  status: LeaseStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLeasePayload {
  tenantId: string;
  propertyId: string;
  unitNumber: string;
  monthlyRent: number;
  startDate: string;
  endDate?: string;
}

export interface UpdateLeasePayload {
  monthlyRent?: number;
  startDate?: string;
  endDate?: string;
  status?: LeaseStatus;
}

const leases: Lease[] = [];

export const leaseService = {
  getAll(): Lease[] {
    return leases;
  },

  getById(id: string): Lease | undefined {
    return leases.find((l) => l.id === id);
  },

  getByTenantId(tenantId: string): Lease[] {
    return leases.filter((l) => l.tenantId === tenantId);
  },

  getByPropertyId(propertyId: string): Lease[] {
    return leases.filter((l) => l.propertyId === propertyId);
  },

  getActiveByTenantId(tenantId: string): Lease | undefined {
    return leases.find((l) => l.tenantId === tenantId && l.status === "active");
  },

  getActiveByPropertyAndUnit(
    propertyId: string,
    unitNumber: string
  ): Lease | undefined {
    return leases.find(
      (l) =>
        l.propertyId === propertyId &&
        l.unitNumber === unitNumber &&
        l.status === "active"
    );
  },

  create(payload: CreateLeasePayload): Lease {
    const now = new Date().toISOString();
    const lease: Lease = {
      id: crypto.randomUUID(),
      tenantId: payload.tenantId,
      propertyId: payload.propertyId,
      unitNumber: payload.unitNumber,
      monthlyRent: payload.monthlyRent,
      startDate: payload.startDate,
      endDate: payload.endDate,
      status: "active",
      createdAt: now,
      updatedAt: now,
    };

    leases.push(lease);
    return lease;
  },

  update(id: string, payload: UpdateLeasePayload): Lease | undefined {
    const existing = leases.find((l) => l.id === id);
    if (!existing) return undefined;

    if (payload.monthlyRent !== undefined) {
      existing.monthlyRent = payload.monthlyRent;
    }
    if (payload.startDate !== undefined) {
      existing.startDate = payload.startDate;
    }
    if (payload.endDate !== undefined) {
      existing.endDate = payload.endDate;
    }
    if (payload.status !== undefined) {
      existing.status = payload.status;
    }

    existing.updatedAt = new Date().toISOString();
    return existing;
  },

  endLease(id: string, endDate: string): Lease | undefined {
    const existing = leases.find((l) => l.id === id);
    if (!existing) return undefined;

    existing.status = "ended";
    existing.endDate = endDate;
    existing.updatedAt = new Date().toISOString();

    return existing;
  },
};
