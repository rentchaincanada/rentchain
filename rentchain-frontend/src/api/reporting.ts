import { apiJson } from "../lib/apiClient";

export async function fetchMonthlySnapshot() {
  return apiJson("/api/reporting/monthly-snapshot");
}
