// src/services/dashboardClient.js

import { apiJson } from "../lib/apiClient";

/**
 * Fetch dashboard overview data from the backend.
 * Adjust the URL path if your API route is different.
 */
export async function fetchDashboardOverview() {
  return apiJson("/dashboard/overview");
}
