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
): Promise<{ leases: Lease[]; diagnostics?: any; credibilitySummary?: PropertyCredibilitySummary | null }> {
  return apiJson<{ leases: Lease[]; diagnostics?: any; credibilitySummary?: PropertyCredibilitySummary | null }>(
    `/leases/property/${encodeURIComponent(propertyId)}`
  );
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
