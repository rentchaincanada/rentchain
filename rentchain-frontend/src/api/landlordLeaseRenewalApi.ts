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

export type RenewalNoticeDraftSnapshotSourceValues = {
  tenantLabel: string;
  propertyUnitLabel: string;
  currentRentLabel: string;
  renewalRentLabel: string;
  currentLeaseEndLabel: string;
  proposedTermLabel: string;
  tenantResponseTargetDateLabel: string;
};

export type SaveRenewalNoticeDraftSnapshotPayload = {
  draftText: string;
  generatedAt?: string;
  sourceValues: RenewalNoticeDraftSnapshotSourceValues;
  noDeliveryFlags: {
    emailSent: false;
    noticeServed: false;
    tenantNotified: false;
  };
};

export type RenewalNoticeDraftSnapshot = {
  snapshotId: string;
  savedAt: string;
  actor?: {
    id?: string | null;
    email?: string | null;
  } | null;
  source: "renewal_notice_draft";
  status: "draft_saved";
  flags: {
    emailSent: false;
    noticeServed: false;
    tenantNotified: false;
  };
  auditEventId?: string | null;
  canonicalEventId?: string | null;
};

export type SendRenewalNoticeCommunicationPayload = {
  snapshotId: string;
  approvalDecisionItemId: string;
  confirmationAccepted: true;
  recipientReviewed: true;
  bodyReviewed: true;
  legalServiceAcknowledged: true;
  noLegalServiceClaim: true;
  idempotencyKey: string;
};

export type RenewalNoticeCommunicationResponse = {
  ok: true;
  idempotent?: boolean;
  communicationId: string;
  status: "send_attempted" | "email_sent" | "email_failed";
  deliveryStatus: "delivery_status_unknown";
  attemptedAt: string;
  sentAt: string | null;
  providerMessageId: null;
  auditEventId: string | null;
  timelineEventId: string | null;
  noLegalServiceClaim: true;
  noticeServed: false;
  tenantNotified: boolean;
  legalServiceEstablished: false;
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

export function sendRenewalNoticeCommunication(
  leaseId: string,
  payload: SendRenewalNoticeCommunicationPayload
) {
  return apiFetch<RenewalNoticeCommunicationResponse>(
    `/landlord/leases/${encodeURIComponent(leaseId)}/renewal-notice-communications`,
    {
      method: "POST",
      body: payload,
    }
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

export function saveRenewalNoticeDraftSnapshot(leaseId: string, payload: SaveRenewalNoticeDraftSnapshotPayload) {
  return apiFetch<{ ok: true; snapshot: RenewalNoticeDraftSnapshot }>(
    `/landlord/leases/${encodeURIComponent(leaseId)}/renewal-notice-draft-snapshots`,
    {
      method: "POST",
      body: payload,
    }
  );
}
