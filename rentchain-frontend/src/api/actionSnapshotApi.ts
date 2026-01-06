import { apiGetJson } from "./http";

export async function fetchMonthlyOpsSnapshot() {
  const res = await apiGetJson<{
    generatedAt: string;
    totals: {
      open: number;
      highSeverity: number;
      oldestOpenDays: number | null;
    };
    properties: Record<string, { openCount: number; highSeverity: number; oldestDays: number | null }>;
  }>("/action-requests/snapshot", { allowStatuses: [404, 501] });

  if (res.ok) return res.data;
  if (res.status === 404 || res.status === 501) return null;
  return null;
}
