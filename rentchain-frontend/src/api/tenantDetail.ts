// rentchain-frontend/src/api/tenantDetail.ts
import type { TenantApiModel } from "./tenants";
import { apiFetch } from "./http";

export interface TenantDetailTenant extends TenantApiModel {
  fullName?: string;
  email?: string;
  phone?: string;
  leaseStart?: string;
  leaseEnd?: string;
  monthlyRent?: string | number;
  riskLevel?: string;
}

export interface TenantLeaseSummary {
  tenantId: string;
  propertyName: string;
  unit: string;
  leaseStart: string;
  leaseEnd: string;
  monthlyRent: string | number;
}

export interface TenantPayment {
  id: string;
  tenantId: string;
  amount: number;
  paidAt: string;
  method?: string;
  notes?: string | null;
  status?: string;
}

export interface TenantLedgerEntry {
  id: string;
  tenantId: string;
  type: string;
  amount: number;
  date: string;
  method?: string;
  notes?: string;
  direction?: "debit" | "credit";
  runningBalance?: number;
  referenceId?: string | null;
}

export interface TenantInsight {
  // currently empty array in your JSON, but we keep this for future AI work
  [key: string]: any;
}

export interface TenantDetailBundle {
  tenant: TenantDetailTenant | null;
  lease?: TenantLeaseSummary | null;
  payments?: TenantPayment[];
  ledger?: TenantLedgerEntry[];
  ledgerSummary?: {
    currentBalance: number;
    lastPaymentDate: string | null;
    entryCount: number;
  };
  insights?: TenantInsight[];
}

/**
 * GET /api/tenants/:tenantId
 */
export async function fetchTenantDetail(
  tenantId: string
): Promise<TenantDetailBundle> {
  if (!tenantId) {
    throw new Error("tenantId is required");
  }

  const res = await apiFetch<TenantDetailBundle>(
    `/tenants/${encodeURIComponent(tenantId)}`
  );
  return res;
}
