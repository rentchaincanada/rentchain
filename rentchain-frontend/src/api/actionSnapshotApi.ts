import { apiFetch } from "./apiFetch";

export async function fetchMonthlyOpsSnapshot() {
  return apiFetch<{
    generatedAt: string;
    totals: {
      open: number;
      highSeverity: number;
      oldestOpenDays: number | null;
    };
    properties: Record<
      string,
      { openCount: number; highSeverity: number; oldestDays: number | null }
    >;
  }>("/action-requests/snapshot");
}
