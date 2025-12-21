// @ts-nocheck
// src/services/dashboardAiService.ts

// Prefer Vite-style env var if available, otherwise fall back to localhost
const API_BASE_URL =
  (import.meta as any).env?.VITE_API_BASE_URL || "http://localhost:3000";

function authHeaders() {
  const token =
    sessionStorage.getItem("rentchain_token") ||
    localStorage.getItem("rentchain_token") ||
    sessionStorage.getItem("token") ||
    localStorage.getItem("token") ||
    null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export type DashboardAiInsightType = "info" | "warning" | "opportunity";

export interface DashboardAiInsight {
  id: string;
  type: DashboardAiInsightType;
  message: string;
}

export interface DashboardAiRequestPayload {
  selectedPropertyName?: string | null;
  timeRange?: string | null;
  // kpis can be any structured object; we just forward it to the backend
  kpis?: any;
}

export interface DashboardAiInsightsResponse {
  insights: DashboardAiInsight[];
}

/**
 * Call the backend AI insights endpoint.
 */
export async function fetchDashboardAiInsights(
  payload: DashboardAiRequestPayload
): Promise<DashboardAiInsightsResponse> {
  const res = await fetch(`${API_BASE_URL}/dashboard/ai-insights`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `AI insights API error ${res.status}: ${
        text || res.statusText || "Unknown error"
      }`
    );
  }

  const data = (await res.json()) as DashboardAiInsightsResponse;

  // Normalize to avoid undefined issues
  return {
    insights: data?.insights ?? [],
  };
}
