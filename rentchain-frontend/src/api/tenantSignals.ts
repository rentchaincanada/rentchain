import { apiJson } from "../lib/apiClient";

export type TenantSignals = {
  tenantId: string;
  landlordId: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  latePaymentsCount: number;
  nsfCount: number;
  missedPaymentsCount: number;
  evictionNoticeCount: number;
  positiveNotesCount: number;
  lastEventAt: number | null;
  computedAt: number;
};

export async function getTenantSignals(tenantId: string) {
  return apiJson<{ ok: boolean; signals: TenantSignals }>(
    `/api/tenants/${encodeURIComponent(tenantId)}/signals`
  );
}
