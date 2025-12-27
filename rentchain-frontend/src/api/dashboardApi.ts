import { apiJson } from "@/lib/apiClient";
import type { PortfolioAiSummary, PortfolioSnapshot } from "../types/models";

const warned: Record<string, boolean> = {};
function warnOnce(key: string, message: string) {
  if (warned[key]) return;
  warned[key] = true;
  console.warn(message);
}

export interface DashboardOverviewKpis {
  monthlyRent: number;
  occupancyRate: number;
  latePayments: number;
  portfolioValue: number;
  generatedAt: string;
  status?: string;
}

export async function fetchDashboardOverview(): Promise<DashboardOverviewKpis> {
  try {
    return await apiJson<DashboardOverviewKpis>("/dashboard/overview");
  } catch (err: any) {
    if (String(err?.message ?? "").includes("404")) {
      warnOnce(
        "dashboard:overview",
        "[dashboard] /dashboard/overview missing; returning fallback KPIs"
      );
      const now = new Date().toISOString();
      return {
        monthlyRent: 0,
        occupancyRate: 0,
        latePayments: 0,
        portfolioValue: 0,
        generatedAt: now,
        status: "missing_endpoint",
      };
    }
    throw err;
  }
}

export interface DashboardKpis {
  totalProperties: number;
  totalUnits: number;
  occupancyRate: number; // 0–1
  monthlyRentRoll: number;
  monthlyCollected: number;
  monthlyDelinquent: number;
}

export interface DashboardPropertySummary {
  id: string;
  name: string;
  city?: string;
  units: number;
  occupiedUnits: number;
  occupancyRate: number; // 0–1
  avgRent: number;
  risk?: "Low" | "Medium" | "High" | string;
}

export interface DashboardOverviewForInsights {
  kpis: DashboardKpis;
  properties: DashboardPropertySummary[];
}

export async function fetchDashboardOverviewForInsights(): Promise<DashboardOverviewForInsights> {
  try {
    return await apiJson<DashboardOverviewForInsights>("/dashboard/overview");
  } catch (err: any) {
    if (String(err?.message ?? "").includes("404")) {
      warnOnce(
        "dashboard:overview-insights",
        "[dashboard] /dashboard/overview missing; returning fallback insights payload"
      );
      return {
        kpis: {
          totalProperties: 0,
          totalUnits: 0,
          occupancyRate: 0,
          monthlyRentRoll: 0,
          monthlyCollected: 0,
          monthlyDelinquent: 0,
        },
        properties: [],
      };
    }
    throw err;
  }
}

export interface PortfolioAiResponse {
  generatedAt: string;
  snapshot: PortfolioSnapshot;
  aiSummary: PortfolioAiSummary;
}

// POST /dashboard/ai-summary (new format used by AiPortfolioDrawer)
export async function fetchPortfolioAiSummary(): Promise<PortfolioAiResponse> {
  try {
    return await apiJson<PortfolioAiResponse>("/dashboard/ai-summary", { method: "POST" });
  } catch (err: any) {
    const status = err?.status ?? err?.payload?.status ?? err?.body?.status;
    if (status === 403 || status === 404) {
      warnOnce(
        "dashboard:ai-summary",
        "[dashboard] /dashboard/ai-summary missing; returning fallback AI summary"
      );
      return {
        generatedAt: new Date().toISOString(),
        snapshot: { properties: [], tenants: [], units: [] } as any,
        aiSummary: {
          healthLabel: "Stable",
          summaryText: "",
          risks: [],
          opportunities: [],
          suggestedActions: [],
        },
      };
    }
    throw err;
  }
}

export interface AiPortfolioSummary {
  summary: string;
  healthScore: number;
  timeframeLabel: string;
  kpis: {
    occupancyRate?: number;
    monthlyRentRoll?: number;
    monthlyCollected?: number;
    monthlyDelinquent?: number;
    collectionRatio?: number;
    delinquencyRatio?: number;
  };
  trend: {
    collectionsDirection: "up" | "down" | "flat";
    riskDirection: "up" | "down" | "flat";
  };
  risks: string[];
  opportunities: string[];
}

export interface PortfolioSummaryResponse {
  kpis: {
    totalProperties: number;
    totalUnits: number;
    occupancyRate: number;
    monthlyRentRoll: number;
    monthlyCollected: number;
    monthlyDelinquent: number;
  };
  narrative: string;
}

export async function fetchAiPortfolioSummary(): Promise<AiPortfolioSummary> {
  try {
    return await apiJson<AiPortfolioSummary>("/dashboard/ai-portfolio-summary");
  } catch (err: any) {
    if (String(err?.message ?? "").includes("404")) {
      warnOnce(
        "dashboard:ai-portfolio",
        "[dashboard] /dashboard/ai-portfolio-summary missing; returning fallback AI portfolio summary"
      );
      return {
        summary: "",
        healthScore: 0,
        timeframeLabel: "",
        kpis: {
          occupancyRate: 0,
          monthlyRentRoll: 0,
          monthlyCollected: 0,
          monthlyDelinquent: 0,
          collectionRatio: 0,
          delinquencyRatio: 0,
        },
        trend: { collectionsDirection: "flat", riskDirection: "flat" },
        risks: [],
        opportunities: [],
      };
    }
    throw err;
  }
}

export async function fetchPortfolioSummary(): Promise<PortfolioSummaryResponse> {
  try {
    const data = await apiJson<any>("/dashboard/portfolio-summary");
    return data?.summary ?? data;
  } catch (err: any) {
    if (String(err?.message ?? "").includes("404")) {
      warnOnce(
        "dashboard:portfolio-summary",
        "[dashboard] /dashboard/portfolio-summary missing; returning fallback portfolio summary"
      );
      return {
        kpis: {
          totalProperties: 0,
          totalUnits: 0,
          occupancyRate: 0,
          monthlyRentRoll: 0,
          monthlyCollected: 0,
          monthlyDelinquent: 0,
        },
        narrative: "",
      };
    }
    throw err;
  }
}
