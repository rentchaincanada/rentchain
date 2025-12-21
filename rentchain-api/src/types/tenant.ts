// src/types/tenant.ts

export type TenantRiskLevel = "Low" | "Medium" | "High";

export interface Tenant {
  id: string;
  fullName: string;
  email?: string;
  phone?: string;
  unit?: string;
  propertyName?: string;
  leaseStart?: string;
  leaseEnd?: string;
  monthlyRent?: number;
  status?: "Current" | "NoticeGiven" | "Former" | "Prospect";
  balance?: number;
  riskLevel?: TenantRiskLevel;
}

export interface TenantLease {
  tenantId: string;
  propertyName: string;
  unit: string;
  leaseStart: string;
  leaseEnd?: string;
  monthlyRent: number;
  paymentDayOfMonth: number;
}

export interface TenantPayment {
  id: string;
  tenantId: string;
  paidAt: string; // ISO date
  amount: number;
  method?: string;
  status: "OnTime" | "Late" | "Partial" | "Missed";
  note?: string;
}

export interface TenantLedgerEvent {
  id: string;
  tenantId: string;
  occurredAt: string; // ISO date
  type:
    | "RentCharge"
    | "Payment"
    | "LateFee"
    | "NSF"
    | "Credit"
    | "Adjustment"
    | "Note";
  description: string;
  amount: number; // positive for charges, negative for credits/payments
  balanceAfter?: number;
}

export interface TenantInsight {
  id: string;
  title: string;
  severity: "info" | "warning" | "critical";
  summary: string;
  detail?: string;
  tags?: string[];
}

export interface TenantDataBundle {
  tenant: Tenant | null;
  lease: TenantLease | null;
  payments: TenantPayment[];
  ledger: TenantLedgerEvent[];
  insights: TenantInsight[];
}
