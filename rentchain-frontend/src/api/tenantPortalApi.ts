import { apiFetch } from "./http";
import { DEBUG_AUTH_KEY } from "../lib/authKeys";

export type TenantSafeProjectionMetadata = {
  projectionProfile?: {
    projectionName: string;
    projectionVersion: string;
    audience: "tenant_workspace";
    scopeType: string;
    allowedSourceCollections: string[];
    allowedFieldGroups: string[];
    excludedFieldGroups: string[];
    sensitivityClass: "sensitive";
    authorityBasis: "authenticated_tenant_scope";
    relationshipBasis: string;
    internalReferencePolicy: string;
    redactionPolicy: string;
  };
  projectionVersion?: string;
  sensitivityClass?: "sensitive";
  authorityBasis?: "authenticated_tenant_scope";
  sourceCollections?: string[];
  sourceRefs?: Array<{
    sourceCollection: string;
    sourceId: string;
  }>;
  redactionSummary?: {
    redactionPolicy: string;
    redactedFieldGroups: string[];
    redactionCount: number;
  };
};

export interface TenantProfile {
  id: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  landlordId?: string | null;
  createdAt?: string | null;
}

export interface TenantLease extends TenantSafeProjectionMetadata {
  leaseId: string | null;
  propertyId: string | null;
  propertyName: string | null;
  unitId: string | null;
  unitNumber: string | null;
  rentAmount: number | null;
  leaseStart: string | null;
  leaseEnd: string | null;
  status: string | null;
  documentUrl?: string | null;
  leaseDocumentContext?: TenantLeaseDocumentContext | null;
  scheduleADocumentContext?: TenantLeaseDocumentContext | null;
  signatureStatus?: "not_started" | "awaiting_tenant_signature" | "awaiting_landlord_signature" | "signed" | "unavailable";
  signatureReadinessLabel?: string | null;
  signatureReadinessDescription?: string | null;
  tenantSignature?: {
    signedAt: string | null;
    signatureMethod: "typed" | "drawn" | null;
    signatureDisplayName: string | null;
  } | null;
  leasePdfStatus?: "available" | "pending" | "not_available";
  leasePdfLabel?: string | null;
  leasePdfDescription?: string | null;
  leaseExecution?: {
    executionStatus:
      | "draft"
      | "ready_for_tenant_signature"
      | "tenant_signed"
      | "ready_for_landlord_signature"
      | "landlord_signed"
      | "fully_executed"
      | "blocked";
    executionLabel: string;
    executionDescription: string;
    requiredNextAction:
      | "complete_lease_details"
      | "tenant_signature"
      | "landlord_signature"
      | "review_signed_lease"
      | "none";
    tenantSignatureStatus: "not_required" | "needed" | "completed" | "blocked";
    landlordSignatureStatus: "not_required" | "needed" | "completed" | "blocked";
    pdfStatus: "not_ready" | "ready" | "generated" | "blocked";
    completedAt: string | null;
  } | null;
  paymentReadiness?: {
    readinessStatus: "not_ready" | "ready_to_configure" | "blocked";
    readinessLabel: string;
    readinessDescription: string;
    requiredNextAction: "complete_lease_details" | "review_rent_terms" | "confirm_payment_setup_later" | "none";
    rentTerms: {
      rentAmountAvailable: boolean;
      dueDateAvailable: boolean;
      leaseDatesAvailable: boolean;
      tenantLinked: boolean;
      leaseExecuted: boolean;
    };
    paymentSetup: {
      processorConnected: false;
      moneyMovementEnabled: false;
      storedPaymentMethod: false;
    };
  } | null;
}

export interface TenantLeaseDocumentContext {
  leaseId?: string | null;
  tenantId?: string | null;
  propertyId?: string | null;
  unitId?: string | null;
  leaseStatus?: string | null;
  signingStatus?: string | null;
  documentStatus: "signed" | "generated" | "pending" | "missing";
  documentId?: string | null;
  documentUrl?: string | null;
  displayLabel: string;
  source: string;
  confidence: "high" | "medium" | "low";
  warnings: string[];
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
  const res = await apiFetch<any>("/tenant/lease");
  if (res?.lease && typeof res.lease === "object") {
    return res.lease as TenantLease;
  }
  return res as TenantLease;
}

export async function signTenantLease(leaseId: string): Promise<TenantLease> {
  const res = await apiFetch<any>(`/tenant/leases/${encodeURIComponent(leaseId)}/sign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  if (res?.data && typeof res.data === "object") {
    return res.data as TenantLease;
  }
  return res as TenantLease;
}

export async function getTenantPayments(): Promise<TenantPayment[]> {
  const res = await apiFetch<any>("/tenant/payments");
  if (Array.isArray(res)) return res as TenantPayment[];
  if (Array.isArray(res?.data)) return res.data as TenantPayment[];
  if (Array.isArray(res?.items)) return res.items as TenantPayment[];
  if (Array.isArray(res?.payments)) return res.payments as TenantPayment[];
  return [];
}

export async function getTenantLedger(): Promise<TenantLedgerEntry[]> {
  return apiFetch<TenantLedgerEntry[]>("/tenant/ledger");
}

export async function getTenantDocuments(): Promise<TenantDocument[]> {
  return apiFetch<TenantDocument[]>("/tenant/documents");
}

export async function getTenantPaymentsSummary(): Promise<TenantPaymentsSummary> {
  const res = await apiFetch<any>("/tenant/payments/summary");
  if (res?.data && typeof res.data === "object") return res.data as TenantPaymentsSummary;
  if (res?.summary && typeof res.summary === "object") return res.summary as TenantPaymentsSummary;
  return res as TenantPaymentsSummary;
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
  const res = await apiFetch<any>("/tenant/rent-charges");
  if (Array.isArray(res)) return res as TenantRentCharge[];
  if (Array.isArray(res?.data)) return res.data as TenantRentCharge[];
  if (Array.isArray(res?.items)) return res.items as TenantRentCharge[];
  if (Array.isArray(res?.charges)) return res.charges as TenantRentCharge[];
  return [];
}

export async function confirmTenantRentCharge(id: string): Promise<{ ok: boolean; confirmedAt?: string }> {
  return apiFetch<{ ok: boolean; confirmedAt?: string }>(`/tenant/rent-charges/${encodeURIComponent(id)}/confirm`, {
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
