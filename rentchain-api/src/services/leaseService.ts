import crypto from "crypto";
import type { RiskAssessment } from "./risk/riskTypes";

export type LeaseStatus = "active" | "ended";
export type LeaseRenewalStatus = "unknown" | "offered" | "accepted" | "declined";

export interface Lease {
  id: string;
  tenantId: string;
  tenantIds?: string[];
  primaryTenantId?: string | null;
  propertyId: string;
  unitNumber: string;
  monthlyRent: number;
  startDate: string;
  endDate?: string | null;
  automationEnabled: boolean;
  renewalStatus: LeaseRenewalStatus;
  status: LeaseStatus;
  risk?: RiskAssessment | null;
  riskScore?: number | null;
  riskGrade?: string | null;
  riskConfidence?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLeasePayload {
  tenantId: string;
  tenantIds?: string[];
  primaryTenantId?: string | null;
  propertyId: string;
  unitNumber: string;
  monthlyRent: number;
  startDate: string;
  endDate?: string | null;
  automationEnabled?: boolean;
  renewalStatus?: LeaseRenewalStatus;
  risk?: RiskAssessment | null;
}

export interface UpdateLeasePayload {
  monthlyRent?: number;
  startDate?: string;
  endDate?: string | null;
  automationEnabled?: boolean;
  renewalStatus?: LeaseRenewalStatus;
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
    return leases.filter((l) => l.tenantId === tenantId || Array.isArray(l.tenantIds) && l.tenantIds.includes(tenantId));
  },

  getByPropertyId(propertyId: string): Lease[] {
    return leases.filter((l) => l.propertyId === propertyId);
  },

  getActiveByTenantId(tenantId: string): Lease | undefined {
    return leases.find((l) => (l.tenantId === tenantId || Array.isArray(l.tenantIds) && l.tenantIds.includes(tenantId)) && l.status === "active");
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
    const tenantIds = Array.isArray(payload.tenantIds)
      ? payload.tenantIds.map((value) => String(value || "").trim()).filter(Boolean)
      : [String(payload.tenantId || "").trim()].filter(Boolean);
    const primaryTenantId = String(payload.primaryTenantId || payload.tenantId || tenantIds[0] || "").trim() || null;
    const lease: Lease = {
      id: crypto.randomUUID(),
      tenantId: primaryTenantId || payload.tenantId,
      tenantIds,
      primaryTenantId,
      propertyId: payload.propertyId,
      unitNumber: payload.unitNumber,
      monthlyRent: payload.monthlyRent,
      startDate: payload.startDate,
      endDate: payload.endDate,
      automationEnabled: payload.automationEnabled ?? true,
      renewalStatus: payload.renewalStatus ?? "unknown",
      status: "active",
      risk: payload.risk ?? null,
      riskScore: payload.risk?.score ?? null,
      riskGrade: payload.risk?.grade ?? null,
      riskConfidence: payload.risk?.confidence ?? null,
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
    if (payload.automationEnabled !== undefined) {
      existing.automationEnabled = payload.automationEnabled;
    }
    if (payload.renewalStatus !== undefined) {
      existing.renewalStatus = payload.renewalStatus;
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
