import { apiFetch } from "./http";
import { DEBUG_AUTH_KEY } from "../lib/authKeys";

export interface TenantProfile {
  id: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  landlordId?: string | null;
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
  const dbg = localStorage.getItem(DEBUG_AUTH_KEY) === "1";
  if (dbg) {
    // eslint-disable-next-line no-console
    console.log("[tenantMe] calling API via apiFetch('/tenant/me')");
  }
  return apiFetch<TenantProfile>("/tenant/me");
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

export type TenantIssuePayload = {
  category: string;
  subject: string;
  message: string;
  tenantId?: string;
  unitId?: string;
  attachments?: any[];
};

export async function submitTenantIssue(payload: TenantIssuePayload): Promise<{ ok: boolean; stub?: boolean }> {
  // If/when a backend endpoint exists, replace this with a real call.
  // For now, return a stubbed success so tenant portal can compile and function.
  return { ok: true, stub: true, ...payload };
}
