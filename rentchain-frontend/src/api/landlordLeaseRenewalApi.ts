import { apiFetch } from "./apiFetch";
import type { LeaseLifecycleSummary } from "./leasesApi";

export type LandlordLeaseRenewalOperatorInput = {
  rentChangeMode: "no_change" | "increase" | "decrease" | "undecided" | null;
  proposedRent: number | null;
  newTermType: "fixed_term" | "year_to_year" | "month_to_month" | null;
  newLeaseStartDate: string | null;
  newLeaseEndDate: string | null;
  responseDeadlineAt: number | null;
};

export type LandlordLeaseRenewalLease = {
  id: string;
  tenantId: string;
  propertyId: string | null;
  propertyAddress: string | null;
  unitId: string | null;
  status: string;
  leaseType: "fixed_term" | "year_to_year" | "month_to_month";
  province: string;
  leaseStartDate: string | null;
  leaseEndDate: string | null;
  currentRent: number | null;
  currency: string;
  nextNoticeDueAt: number | null;
  latestNoticeId: string | null;
  tenantName: string | null;
  unitLabel: string | null;
  propertyLabel: string | null;
  renewalRentChangeMode: "no_change" | "increase" | "decrease" | "undecided" | null;
  renewalOfferedRent: number | null;
  renewalDecisionDeadlineAt: string | number | null;
  renewalNewTermType: "fixed_term" | "year_to_year" | "month_to_month" | null;
  renewalNewLeaseStartDate: string | null;
  renewalNewLeaseEndDate: string | null;
  renewalUpdatedAt?: string | number | null;
  updatedAt?: string | number | null;
  noticeBucket?: "expiring" | "pending-response" | "no-response";
  leaseLifecycleSummary?: LeaseLifecycleSummary;
};

export function fetchExpiringLeaseRenewals(params?: {
  propertyId?: string | null;
  withinDays?: number;
  status?: "expiring" | "pending-response" | "no-response" | null;
}) {
  const search = new URLSearchParams();
  if (params?.propertyId) search.set("propertyId", params.propertyId);
  if (typeof params?.withinDays === "number" && Number.isFinite(params.withinDays)) {
    search.set("withinDays", String(params.withinDays));
  }
  if (params?.status) search.set("status", params.status);
  const suffix = search.size ? `?${search.toString()}` : "";
  return apiFetch<{ ok: true; items: LandlordLeaseRenewalLease[]; data: LandlordLeaseRenewalLease[] }>(
    `/landlord/leases/expiring${suffix}`
  );
}

export function saveLeaseRenewalInputs(leaseId: string, payload: LandlordLeaseRenewalOperatorInput) {
  return apiFetch<{
    ok: true;
    lease: LandlordLeaseRenewalLease;
    renewalInputs: LandlordLeaseRenewalOperatorInput;
  }>(`/landlord/leases/${encodeURIComponent(leaseId)}/renewal-inputs`, {
    method: "PUT",
    body: payload,
  });
}
