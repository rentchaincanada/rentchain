import { tenantApiFetch } from "./tenantApiFetch";

export type TenantNoticeSummary = {
  id: string;
  type: string;
  title: string;
  effectiveAt: number | null;
  createdAt: number | null;
  status: string;
};

export type TenantNoticeDetail = TenantNoticeSummary & {
  landlordId: string | null;
  tenantId: string | null;
  body: string;
  createdBy: string | null;
};

export function getTenantNotices() {
  return tenantApiFetch<{ ok: boolean; data: TenantNoticeSummary[] }>("/tenant/notices");
}

export function getTenantNotice(noticeId: string) {
  return tenantApiFetch<{ ok: boolean; data: TenantNoticeDetail }>(`/tenant/notices/${noticeId}`);
}
