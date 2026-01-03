import { apiFetch } from "./apiFetch";

export type OpsMonthlySnapshot = {
  ok: boolean;
  windowDays: number;
  usingActiveWindow: boolean;
  totals: {
    totalTenants: number;
    avgScore: number | null;
    atRiskCount: number;
    tierCounts: { excellent: number; good: number; watch: number; risk: number };
    totalLate90d: number;
    totalPaid90d: number;
    totalNotices12m: number;
  };
  topRisk: Array<{
    tenantId: string;
    scoreV1: number;
    tierV1: "excellent" | "good" | "watch" | "risk";
    lastEventAt: any;
    signals: any;
  }>;
  generatedAt: number;
};

export async function getMonthlyOpsSnapshot(params?: { windowDays?: number; topN?: number }) {
  const qs = new URLSearchParams();
  if (params?.windowDays) qs.set("windowDays", String(params.windowDays));
  if (params?.topN) qs.set("topN", String(params.topN));
  return apiFetch<OpsMonthlySnapshot>(`/api/ops/monthly-snapshot?${qs.toString()}`);
}
