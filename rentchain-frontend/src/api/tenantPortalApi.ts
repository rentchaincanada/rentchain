import { apiFetch } from "./http";

export interface TenantProfile {
  id: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  createdAt?: string | null;
}

export interface TenantLease {
  leaseId: string | null;
  propertyId: string | null;
  propertyName: string | null;
  unitId: string | null;
  unitNumber: string | null;
  rentAmount: number | null;
  leaseStart: string | null;
  leaseEnd: string | null;
  status: string | null;
}

export interface TenantPayment {
  id: string;
  amount: number;
  dueDate: string | null;
  paidAt: string | null;
  method: string | null;
  status: string | null;
  notes?: string | null;
}

export interface TenantLedgerEntry {
  id: string;
  type: string;
  occurredAt: string | null;
  title: string | null;
  description: string | null;
  amount: number | null;
  meta?: any;
}

export interface TenantDocument {
  id: string;
  type: string;
  title: string;
  description?: string | null;
  fileUrl: string | null;
  issuedAt: string | null;
}

export type PaymentStatus = "on_time" | "late" | "partial" | "unpaid" | "unknown";

export interface TenantPaymentsSummary {
  tenantId: string;
  leaseId?: string | null;
  rentAmount?: number;
  rentDayOfMonth?: number;
  nextDueDate?: string;
  lastPayment?: {
    amount: number;
    paidAt?: string | null;
    dueDate?: string | null;
    status?: Exclude<PaymentStatus, "unpaid">;
  } | null;
  currentPeriod?: {
    periodStart?: string | null;
    periodEnd?: string | null;
    amountDue?: number | null;
    amountPaid?: number | null;
    status?: PaymentStatus;
  } | null;
}

export async function getTenantMe(): Promise<TenantProfile> {
  return apiFetch<TenantProfile>("tenant/me");
}

export async function getTenantLease(): Promise<TenantLease> {
  return apiFetch<TenantLease>("tenant/lease");
}

export async function getTenantPayments(): Promise<TenantPayment[]> {
  return apiFetch<TenantPayment[]>("tenant/payments");
}

export async function getTenantLedger(): Promise<TenantLedgerEntry[]> {
  return apiFetch<TenantLedgerEntry[]>("tenant/ledger");
}

export async function getTenantDocuments(): Promise<TenantDocument[]> {
  return apiFetch<TenantDocument[]>("tenant/documents");
}

export async function getTenantPaymentsSummary(): Promise<TenantPaymentsSummary> {
  return apiFetch<TenantPaymentsSummary>("tenant/payments/summary");
}

export interface TenantRentCharge {
  id: string;
  amount: number;
  dueDate: string | null;
  period?: string | null;
  status: string;
  issuedAt?: string | null;
  confirmedAt?: string | null;
  paidAt?: string | null;
}

export async function getTenantRentCharges(): Promise<TenantRentCharge[]> {
  return apiFetch<TenantRentCharge[]>("tenant/rent-charges");
}

export async function confirmTenantRentCharge(id: string): Promise<{ ok: boolean; confirmedAt?: string }> {
  return apiFetch<{ ok: boolean; confirmedAt?: string }>(`tenant/rent-charges/${encodeURIComponent(id)}/confirm`, {
    method: "POST",
  });
}
