import { apiGetJson } from "./http";
import type { ActionRequest } from "./actionRequestsApi";

export async function fetchActionCenter(limit = 20) {
  const res = await apiGetJson<{ actionRequests: ActionRequest[] }>(
    `/action-requests/portfolio?limit=${limit}`,
    { allowStatuses: [404, 501] }
  );
  if (res.ok) return res.data;
  if (res.status === 404 || res.status === 501) {
    return { actionRequests: [] };
  }
  return { actionRequests: [] };
}
