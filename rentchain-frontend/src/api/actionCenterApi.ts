import { apiFetch } from "./apiFetch";
import type { ActionRequest } from "./actionRequestsApi";

export async function fetchActionCenter(limit = 20) {
  return apiFetch<{ actionRequests: ActionRequest[] }>(
    `/action-requests/portfolio?limit=${limit}`
  );
}
