// src/services/aiInsightsApi.ts

export type AiSeverity = "info" | "warning" | "critical";

export interface AiInsight {
  id: string;
  title: string;
  severity: AiSeverity;
  body: string;
  tags?: string[];
}

export interface DashboardAiInsightsResponse {
  summary: string;
  insights: AiInsight[];
  generatedAt: string;
}

export interface TenantAiInsightsResponse {
  tenantId: string;
  summary: string;
  insights: AiInsight[];
  generatedAt: string;
}

import { apiJson } from "@/api/http";

export async function fetchDashboardAiInsights(): Promise<DashboardAiInsightsResponse> {
  try {
    return await apiJson<DashboardAiInsightsResponse>("/dashboard/ai-insights");
  } catch (err: any) {
    const status = err?.status ?? err?.body?.status;
    if (status === 404) {
      return { summary: "", insights: [], generatedAt: "" };
    }
    throw err;
  }
}

export async function fetchTenantAiInsights(
  tenantId: string
): Promise<TenantAiInsightsResponse> {
  try {
    return await apiJson<TenantAiInsightsResponse>(
      `/tenants/${encodeURIComponent(tenantId)}/ai-insights`
    );
  } catch (err: any) {
    const status = err?.status ?? err?.body?.status;
    if (status === 404) {
      return {
        tenantId,
        summary: "",
        insights: [],
        generatedAt: "",
      };
    }
    throw err;
  }
}
