import { apiJson } from "@/api/http";
import type { LeaseRiskSnapshot } from "@/types/leaseRisk";
import type { PropertyCredibilitySummary } from "@/types/credibilitySummary";

export type LeaseStatus = "active" | "notice_pending" | "renewal_pending" | "renewal_accepted" | "move_out_pending" | "ended" | "archived";
export type LeaseRenewalStatus = "unknown" | "offered" | "accepted" | "declined";

export interface LeaseAutomationTask {
  id: string;
  leaseId: string;
  kind:
    | "renewal_reminder"
    | "rent_increase_eligibility_check"
    | "renewal_offer_draft"
    | "move_out_reminder_30"
    | "move_out_reminder_14"
    | "move_out_reminder_3";
  mode: "draft" | "reminder";
  dueDate: string;
  reason: string;
  status: "upcoming";
  createdAt: string;
}

export interface Lease {
  id: string;
  tenantId: string;
  tenantIds?: string[];
  primaryTenantId?: string | null;
  propertyId: string;
  unitId?: string | null;
  unitNumber: string;
  monthlyRent: number;
  startDate: string;
  endDate?: string | null;
  automationEnabled?: boolean;
  renewalStatus?: LeaseRenewalStatus;
  status: LeaseStatus;
  risk?: LeaseRiskSnapshot | null;
  riskScore?: number | null;
  riskGrade?: string | null;
  riskConfidence?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface LandlordActiveLease extends Lease {
  propertyName: string;
  tenantName?: string | null;
  tenantEmail?: string | null;
  documentUrl?: string | null;
  archivedAt?: string | null;
  archivedByUserId?: string | null;
  isArchived?: boolean;
}

export interface LeaseReconciliationCandidate {
  id: string;
  unitId: string;
  propertyId: string;
  propertyName: string;
  unitNumber: string;
  occupantName?: string | null;
  leaseEndDate?: string | null;
  monthlyRent: number;
  leaseDocument?: {
    fileName?: string | null;
    url?: string | null;
  } | null;
  canConvert: boolean;
  blockingReasons: string[];
}

export interface LeaseNote {
  id: string;
  leaseId: string;
  landlordId: string;
  note: string;
  createdAt: number | string;
  createdBy?: string | null;
}

export interface PropertyLeaseDiagnostic {
  code?: string;
  message?: string;
  severity?: string;
}

export interface CreateLeasePayload {
  tenantId: string;
  tenantIds?: string[];
  propertyId: string;
  unitNumber: string;
  monthlyRent: number;
  startDate: string;
  endDate?: string | null;
  automationEnabled?: boolean;
  renewalStatus?: LeaseRenewalStatus;
}

export interface UpdateLeasePayload {
  monthlyRent?: number;
  startDate?: string;
  endDate?: string | null;
  automationEnabled?: boolean;
  renewalStatus?: LeaseRenewalStatus;
  status?: LeaseStatus;
}

export async function getLeasesForTenant(
  tenantId: string
): Promise<{ leases: Lease[] }> {
  return apiJson<{ leases: Lease[] }>(
    `/leases/tenant/${encodeURIComponent(tenantId)}`
  );
}

export async function getLeasesForProperty(
  propertyId: string
): Promise<{ leases: Lease[]; diagnostics?: PropertyLeaseDiagnostic[]; credibilitySummary?: PropertyCredibilitySummary | null }> {
  return apiJson<{ leases: Lease[]; diagnostics?: PropertyLeaseDiagnostic[]; credibilitySummary?: PropertyCredibilitySummary | null }>(
    `/leases/property/${encodeURIComponent(propertyId)}`
  );
}

export async function getActiveLeasesForLandlord(): Promise<{ leases: LandlordActiveLease[] }> {
  return apiJson<{ leases: LandlordActiveLease[] }>("/leases/active");
}

export async function getArchivedLeasesForLandlord(): Promise<{ leases: LandlordActiveLease[] }> {
  return apiJson<{ leases: LandlordActiveLease[] }>("/leases/archived");
}

export async function getLeaseReconciliationCandidates(): Promise<{ candidates: LeaseReconciliationCandidate[] }> {
  return apiJson<{ candidates: LeaseReconciliationCandidate[] }>("/leases/reconciliation-candidates");
}

export async function convertUnitReferenceToLease(
  unitId: string,
  payload: {
    occupantName?: string;
    tenantEmail?: string;
    tenantPhone?: string;
    startDate: string;
    endDate?: string | null;
    monthlyRent?: number;
  }
): Promise<{ ok: true; lease: LandlordActiveLease; tenant: { id: string; fullName: string; email?: string | null; phone?: string | null } }> {
  return apiJson(`/leases/reconciliation-candidates/${encodeURIComponent(unitId)}/convert`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function getLeaseById(id: string): Promise<{ lease: LandlordActiveLease }> {
  return apiJson<{ lease: LandlordActiveLease }>(`/leases/${encodeURIComponent(id)}`);
}

export async function getLeaseNotes(id: string): Promise<{ ok: true; notes: LeaseNote[] }> {
  return apiJson<{ ok: true; notes: LeaseNote[] }>(`/leases/${encodeURIComponent(id)}/notes`);
}

export async function createLeaseNote(id: string, note: string): Promise<{ ok: true; note: LeaseNote }> {
  return apiJson<{ ok: true; note: LeaseNote }>(`/leases/${encodeURIComponent(id)}/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ note }),
  });
}

export async function archiveLeaseRecord(id: string): Promise<{ ok: true; lease: LandlordActiveLease }> {
  return apiJson<{ ok: true; lease: LandlordActiveLease }>(`/leases/${encodeURIComponent(id)}/archive`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
}

export async function restoreLeaseRecord(id: string): Promise<{ ok: true; lease: LandlordActiveLease }> {
  return apiJson<{ ok: true; lease: LandlordActiveLease }>(`/leases/${encodeURIComponent(id)}/restore`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
}

export async function createLease(
  payload: CreateLeasePayload
): Promise<{ lease: Lease }> {
  return apiJson<{ lease: Lease }>("/leases", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function updateLease(
  id: string,
  payload: UpdateLeasePayload
): Promise<{ lease: Lease }> {
  return apiJson<{ lease: Lease }>(`/leases/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function endLease(
  id: string,
  endDate?: string
): Promise<{ lease: Lease }> {
  return apiJson<{ lease: Lease }>(
    `/leases/${encodeURIComponent(id)}/end`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endDate }),
    }
  );
}

export async function regenerateLeaseAutomationTasks(
  id: string
): Promise<{ ok: true; tasks: LeaseAutomationTask[] }> {
  return apiJson<{ ok: true; tasks: LeaseAutomationTask[] }>(
    `/leases/${encodeURIComponent(id)}/automation/tasks/regenerate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    }
  );
}

export async function getLeaseAutomationTasks(
  id: string
): Promise<{ ok: true; tasks: LeaseAutomationTask[] }> {
  return apiJson<{ ok: true; tasks: LeaseAutomationTask[] }>(
    `/leases/${encodeURIComponent(id)}/automation/tasks`
  );
}
