import crypto from "crypto";

export interface Payment {
  id: string;
  tenantId: string;
  amount: number;
  paidAt: string;
  method: string;
  notes?: string | null;
  propertyId?: string | null;
}

export interface CreatePaymentPayload {
  tenantId: string;
  amount: number;
  paidAt: string;
  method: string;
  notes?: string | null;
  propertyId?: string | null;
}

const payments: Payment[] = [];

const isSameMonth = (paidAt: string, year: number, month: number): boolean => {
  const d = new Date(paidAt);
  if (Number.isNaN(d.getTime())) return false;
  return d.getFullYear() === year && d.getMonth() + 1 === month;
};

export const paymentsService = {
  getAll(): Payment[] {
    return payments;
  },

  update(id: string, updates: Partial<Payment>): Payment | undefined {
    const idx = payments.findIndex((p) => p.id === id);
    if (idx === -1) return undefined;
    const updated: Payment = { ...payments[idx], ...updates };
    payments[idx] = updated;
    return updated;
  },

  getByTenantId(tenantId: string): Payment[] {
    return payments
      .filter((p) => p.tenantId === tenantId)
      .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime());
  },

  getById(id: string): Payment | undefined {
    return payments.find((p) => p.id === id);
  },

  getByPropertyId(propertyId: string): Payment[] {
    return payments
      .filter((p) => p.propertyId === propertyId)
      .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime());
  },

  create(payload: CreatePaymentPayload): Payment {
    const payment: Payment = {
      id: crypto.randomUUID(),
      tenantId: payload.tenantId,
      amount: payload.amount,
      paidAt: payload.paidAt,
      method: payload.method,
      notes: payload.notes ?? null,
      propertyId: payload.propertyId ?? null,
    };

    payments.push(payment);
    return payment;
  },

  delete(id: string): boolean {
    const idx = payments.findIndex((p) => p.id === id);
    if (idx === -1) return false;
    payments.splice(idx, 1);
    return true;
  },

  getForTenantInMonth(tenantId: string, year: number, month: number): Payment[] {
    return payments.filter(
      (p) => p.tenantId === tenantId && isSameMonth(p.paidAt, year, month)
    );
  },

  getForTenantsInMonth(tenantIds: string[], year: number, month: number): Payment[] {
    const set = new Set(tenantIds);
    return payments.filter(
      (p) => set.has(p.tenantId) && isSameMonth(p.paidAt, year, month)
    );
  },

  getTotalForTenantInMonth(tenantId: string, year: number, month: number): number {
    return this.getForTenantInMonth(tenantId, year, month).reduce(
      (sum, p) => sum + (typeof p.amount === "number" ? p.amount : Number(p.amount) || 0),
      0
    );
  },

  getTotalForTenantsInMonth(tenantIds: string[], year: number, month: number): number {
    return this.getForTenantsInMonth(tenantIds, year, month).reduce(
      (sum, p) => sum + (typeof p.amount === "number" ? p.amount : Number(p.amount) || 0),
      0
    );
  },
};

// Compatibility helpers for existing imports
export const recordPayment = paymentsService.create.bind(paymentsService);
export const getPaymentsForTenant = paymentsService.getByTenantId.bind(paymentsService);
export const getPaymentsForProperty = paymentsService.getByPropertyId.bind(paymentsService);
export const deletePaymentById = paymentsService.delete.bind(paymentsService);
