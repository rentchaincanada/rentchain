// rentchain-frontend/src/api/tenantDetail.ts
import type { TenantApiModel } from "./tenants";
import type { CredibilityInsights } from "@/types/credibilityInsights";
import { apiFetch } from "./http";

export interface TenantDetailTenant extends TenantApiModel {
  fullName?: string;
  email?: string;
  phone?: string;
  leaseStart?: string | null;
  leaseEnd?: string | null;
  monthlyRent?: string | number | null;
  riskLevel?: string;
}

export interface TenantLeaseSummary {
  id?: string;
  tenantId: string;
  propertyId?: string | null;
  propertyName: string;
  propertyAddress?: string | null;
  unitId?: string | null;
  unit: string;
  leaseStart: string | null;
  leaseEnd: string | null;
  monthlyRent: string | number;
  status?: string | null;
}

export interface TenantPropertySummary {
  id: string;
  name: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
}

export interface TenantUnitSummary {
  id: string;
  unitNumber?: string | null;
  status?: string | null;
  rent?: number | null;
}

export interface TenantLeaseNoticeSummary {
  noticeId: string;
  noticeType?: string | null;
  sentAt?: number | null;
  tenantViewedAt?: number | null;
  tenantResponse?: string | null;
  responseDeadlineAt?: number | null;
  deliveryStatus?: string | null;
  leaseStatusAfterResponse?: string | null;
  noResponse?: boolean;
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
  [key: string]: any;
}

export type MoveInRequirementsStatus = "not-started" | "in-progress" | "complete" | "unknown";
export type MoveInRequirementState = "complete" | "pending" | "not-required" | "unknown";
export type MoveInRequirementKey =
  | "lease_signed"
  | "portal_invited"
  | "portal_activated"
  | "deposit_received"
  | "insurance_received"
  | "utility_setup_received"
  | "inspection_scheduled"
  | "inspection_completed"
  | "keys_release_ready";

export interface MoveInRequirementsItem {
  key: MoveInRequirementKey;
  label: string;
  required: boolean;
  state: MoveInRequirementState;
  source?: string | null;
  updatedAt?: string | null;
  note?: string | null;
}

export interface MoveInRequirements {
  status: MoveInRequirementsStatus;
  items: MoveInRequirementsItem[];
  completedCount: number;
  requiredCount: number;
  progressPercent?: number | null;
  lastUpdatedAt?: string | null;
}

export type MoveInReadinessStatus = "not-started" | "in-progress" | "ready" | "completed" | "unknown";

export interface MoveInReadiness {
  status: MoveInReadinessStatus;
  readinessPercent?: number | null;
  leaseSigned?: boolean | null;
  portalInviteSent?: boolean | null;
  portalActivated?: boolean | null;
  depositRequired?: boolean | null;
  depositReceived?: boolean | null;
  insuranceRequired?: boolean | null;
  insuranceReceived?: boolean | null;
  utilitySetupRequired?: boolean | null;
  utilitySetupReceived?: boolean | null;
  inspectionScheduled?: boolean | null;
  inspectionCompleted?: boolean | null;
  keysReleaseReady?: boolean | null;
  outstandingItems?: string[];
  completedItems?: string[];
  lastUpdatedAt?: string | null;
}

export interface TenantDetailBundle {
  tenant: TenantDetailTenant | null;
  lease?: TenantLeaseSummary | null;
  currentLease?: TenantLeaseSummary | null;
  property?: TenantPropertySummary | null;
  unit?: TenantUnitSummary | null;
  latestLeaseNoticeSummary?: TenantLeaseNoticeSummary | null;
  payments?: TenantPayment[];
  ledger?: TenantLedgerEntry[];
  ledgerSummary?: {
    currentBalance: number;
    lastPaymentDate: string | null;
    entryCount: number;
  };
  insights?: TenantInsight[];
  credibilityInsights?: CredibilityInsights | null;
  moveInRequirements?: MoveInRequirements | null;
  moveInReadiness?: MoveInReadiness | null;
}

export async function fetchTenantDetail(tenantId: string): Promise<TenantDetailBundle> {
  if (!tenantId) {
    throw new Error("tenantId is required");
  }

  const res = await apiFetch<TenantDetailBundle>(`/tenants/${encodeURIComponent(tenantId)}`);
  return res;
}
