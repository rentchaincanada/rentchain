import { apiFetch } from "./apiFetch";
import type { PortfolioCredibilitySummary } from "@/types/portfolioCredibilitySummary";

export type DashboardKpis = {
  propertiesCount: number;
  unitsCount: number;
  tenantsCount: number;
  openActionsCount: number;
  delinquentCount: number;
  screeningsCount?: number;
};

export type DashboardRent = {
  month: string;
  collectedCents: number;
  expectedCents: number;
  delinquentCents: number;
};

export type DashboardLeaseNoticeSummary = {
  expiringSoon: number;
  pendingResponse: number;
  renewed: number;
  quitting: number;
  noResponse: number;
};

export type DashboardSummaryData = {
  kpis: DashboardKpis;
  rent: DashboardRent;
  actions: any[];
  properties: any[];
  events: any[];
  leaseNoticeSummary?: DashboardLeaseNoticeSummary;
  portfolioCredibilitySummary?: PortfolioCredibilitySummary | null;
};

export type DashboardSummaryResponse = { ok: true; data: DashboardSummaryData };

export async function fetchDashboardSummary(signal?: AbortSignal): Promise<DashboardSummaryData> {
  const json = await apiFetch<DashboardSummaryResponse>("/api/dashboard/summary", { signal });
  if (!json || (json as any).ok !== true || !(json as any).data) {
    throw new Error("Invalid dashboard response");
  }
  return (json as any).data as DashboardSummaryData;
}
