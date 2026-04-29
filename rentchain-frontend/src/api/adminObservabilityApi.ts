import { apiFetch } from "./apiFetch";

export type SystemObservabilitySummary = {
  generatedAt: string;
  totals: {
    openCritical: number;
    openWarnings: number;
    resolvedLast7Days: number;
  };
  workflows: Array<{
    workflow: string;
    openCritical: number;
    openWarnings: number;
    recentCompleted: number;
    health: "healthy" | "watch" | "attention";
  }>;
  topIssues: Array<{
    title: string;
    workflow: string;
    severity: "info" | "warning" | "critical";
    count: number;
    lastSeenAt: string;
  }>;
};

export async function fetchAdminObservabilitySummary(
  params?: { period?: "7d" | "30d" | null }
): Promise<SystemObservabilitySummary> {
  const search = new URLSearchParams();
  if (params?.period) search.set("period", params.period);
  const query = search.toString();
  const response = await apiFetch<{ ok: true; summary: SystemObservabilitySummary }>(
    `/admin/observability/summary${query ? `?${query}` : ""}`
  );
  return response.summary;
}
