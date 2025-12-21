export type Tenant = {
  id: string;
  fullName?: string;
  email?: string;
  phone?: string;
  status?: "active" | "overdue" | "terminated" | "unknown";
  propertyId?: string;
  unitId?: string;
};

export type TenantLease = {
  id?: string;
  tenantId: string;
  propertyId?: string;
  unitId?: string;
  startDate?: string;
  endDate?: string;
  monthlyRent?: number;
};

export type TenantPayment = {
  id: string;
  tenantId: string;
  amount: number;
  paidAt: string;
  method?: string;
  notes?: string | null;
};

export type TenantLedgerEvent = {
  id: string;
  tenantId: string;
  type?: string;
  amount?: number;
  date?: string;
  balanceAfter?: number;
};

export type TenantAiInsight = Record<string, any>;
