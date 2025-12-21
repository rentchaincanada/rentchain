import { apiJson } from "@/lib/apiClient";
import type { PortfolioAiSummary, PortfolioSnapshot } from "../types/models";

export interface DashboardOverviewKpis {
  monthlyRent: number;
  occupancyRate: number;
  latePayments: number;
  portfolioValue: number;
  generatedAt: string;
  status?: string;
}

export async function fetchDashboardOverview(): Promise<DashboardOverviewKpis> {
  return apiJson<DashboardOverviewKpis>("/dashboard/overview");
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
      return {
        summary: "",
        healthScore: 0,
        timeframeLabel: "—",
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
