import { tenantApiFetch } from "./tenantApiFetch";

export type TenantLeaseNoticeSummary = {
  id: string;
  leaseId: string;
  landlordId: string | null;
  tenantId: string | null;
  propertyId: string | null;
  unitId: string | null;
  noticeType: "renewal_offer" | "end_of_term_notice" | "non_renewal" | "month_to_month_notice" | string;
  legalTemplateKey: string | null;
  province: string | null;
  leaseType: "fixed_term" | "year_to_year" | "month_to_month" | string | null;
  noticeDueAt: number | null;
  sentAt: number | null;
  deliveryStatus: "pending" | "sent" | "failed" | "viewed" | string;
  deliveryChannel: "email" | "platform" | "pdf" | string | null;
  rentChangeMode: "no_change" | "increase" | "decrease" | "undecided" | string;
  currentRent: number | null;
  proposedRent: number | null;
  newTermType: "fixed_term" | "year_to_year" | "month_to_month" | string | null;
  newTermStartDate: string | null;
  newTermEndDate: string | null;
  responseRequired: boolean;
  responseDeadlineAt: number | null;
  tenantResponse: "pending" | "renew" | "quit" | "declined" | string;
  tenantRespondedAt: number | null;
  tenantViewedAt: number | null;
  createdAt: number | null;
  updatedAt: number | null;
  metadata?: {
    noticeRuleVersion?: string | null;
    summary?: {
      title?: string | null;
      body?: string | null;
    } | null;
    [key: string]: unknown;
  } | null;
};

export type TenantLeaseNoticeDetailResponse = {
  ok: boolean;
  item: TenantLeaseNoticeSummary;
  data: TenantLeaseNoticeSummary;
  noResponse: boolean;
};

export type TenantLeaseNoticeRespondResponse = {
  ok: boolean;
  decision: "renew" | "quit";
  noticeId: string;
  leaseId: string;
  landlordNotification?: {
    ok?: boolean;
    attempted?: boolean;
    provider?: string | null;
    reason?: string | null;
  } | null;
  nextStatus: string;
};

export function getTenantLeaseNotices() {
  return tenantApiFetch<{ ok: boolean; items: TenantLeaseNoticeSummary[]; data: TenantLeaseNoticeSummary[] }>(
    "/tenant/lease-notices"
  );
}

export function getTenantLeaseNotice(noticeId: string) {
  return tenantApiFetch<TenantLeaseNoticeDetailResponse>(
    `/tenant/lease-notices/${encodeURIComponent(noticeId)}`
  );
}

export function respondToTenantLeaseNotice(noticeId: string, decision: "renew" | "quit") {
  return tenantApiFetch<TenantLeaseNoticeRespondResponse>(
    `/tenant/lease-notices/${encodeURIComponent(noticeId)}/respond`,
    {
      method: "POST",
      body: { decision },
    }
  );
}
