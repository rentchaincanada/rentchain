// rentchain-frontend/src/api/tenantDetail.ts
import type { TenantApiModel, TenantLifecycle } from "./tenants";
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

export type FinancialProjectionSourceType =
  | "recorded_payment"
  | "lease_charge"
  | "lease_credit"
  | "ledger_payment_unmatched";

export type FinancialProjectionDirection = "credit" | "debit";

export interface FinancialProjectionRow {
  id: string;
  sourceType: FinancialProjectionSourceType;
  sourceId: string;
  leaseId: string | null;
  tenantId: string | null;
  propertyId: string | null;
  unitId: string | null;
  propertyLabel: string | null;
  unitLabel: string | null;
  amount: number;
  direction: FinancialProjectionDirection;
  occurredAt: string;
  displayLabel: string;
  sourceBadge: string;
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

export type MoveInReadinessItemKey =
  | "lease_signed"
  | "tenant_portal_invite_sent"
  | "tenant_portal_activated"
  | "deposit_received"
  | "first_rent_received"
  | "insurance_received"
  | "utility_setup_received"
  | "inspection_scheduled"
  | "inspection_completed"
  | "keys_release_approved"
  | "keys_released";

export type MoveInReadinessItemStatus =
  | "not_started"
  | "pending"
  | "submitted"
  | "confirmed"
  | "blocked"
  | "not_required";

export type MoveInReadinessOverallStatus =
  | "not_started"
  | "in_progress"
  | "blocked"
  | "ready_for_keys"
  | "complete";

export interface MoveInReadinessItem {
  key: MoveInReadinessItemKey;
  label: string;
  stage: "lease" | "onboarding" | "funding" | "inspection" | "keys";
  required: boolean;
  status: MoveInReadinessItemStatus;
  note?: string | null;
  blockerReason?: string | null;
  source: "system" | "manual";
  updatedAt?: string | null;
  updatedByUserId?: string | null;
}

export interface MoveInReadinessEvent {
  id: string;
  type: "item_updated" | "record_created";
  itemKey?: MoveInReadinessItemKey | null;
  label: string;
  note?: string | null;
  status?: MoveInReadinessItemStatus | null;
  actorUserId?: string | null;
  actorRole: "landlord" | "admin" | "system";
  createdAt: string;
}

export interface MoveInReadiness {
  tenantId: string;
  landlordId?: string | null;
  overallStatus: MoveInReadinessOverallStatus;
  completionPercent: number;
  blockerCount: number;
  nextRequiredStep?: string | null;
  lastUpdatedAt?: string | null;
  items: MoveInReadinessItem[];
  events: MoveInReadinessEvent[];
  // Legacy summary compatibility for older readiness UI/tests.
  status?: "not-started" | "in-progress" | "ready" | "completed" | "unknown";
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
  lifecycle?: TenantLifecycle | null;
}

export async function fetchTenantDetail(tenantId: string): Promise<TenantDetailBundle> {
  if (!tenantId) {
    throw new Error("tenantId is required");
  }

  const res = await apiFetch<TenantDetailBundle>(`/tenants/${encodeURIComponent(tenantId)}`);
  return res;
}

export async function fetchTenantFinancialActivity(tenantId: string): Promise<FinancialProjectionRow[]> {
  if (!tenantId) {
    throw new Error("tenantId is required");
  }

  const res = await apiFetch<{ ok: true; data: { rows: FinancialProjectionRow[] } }>(
    `/tenants/${encodeURIComponent(tenantId)}/financial-activity`
  );
  return Array.isArray(res?.data?.rows) ? res.data.rows : [];
}

export async function updateTenantMoveInReadiness(
  tenantId: string,
  updates: Array<{
    key: MoveInReadinessItemKey;
    status: MoveInReadinessItemStatus;
    note?: string | null;
    blockerReason?: string | null;
  }>
): Promise<MoveInReadiness> {
  const res = await apiFetch<{ ok: boolean; readiness: MoveInReadiness }>(
    `/tenants/${encodeURIComponent(tenantId)}/move-in-readiness`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates }),
    }
  );
  return res.readiness;
}
