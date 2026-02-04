// @ts-nocheck
// src/services/dashboardAiService.ts

// Prefer Vite-style env var if available, otherwise fall back to localhost
import API_BASE from "../config/apiBase";
import { getAuthToken } from "../lib/authToken";
import { getFirebaseIdToken } from "../lib/firebaseAuthToken";

const API_BASE_URL = API_BASE.replace(/\/$/, "");

async function authHeaders() {
  const firebaseToken = await getFirebaseIdToken();
  const token = firebaseToken || getAuthToken();
  if (token) {
    return {
      Authorization: `Bearer ${token}`,
      "x-rc-auth": firebaseToken ? "firebase" : "bearer",
    };
  }
  return { "x-rc-auth": "missing" };
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
      ...(await authHeaders()),
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
