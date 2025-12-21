import { apiFetch } from "./apiFetch";

export async function fetchActionRequestCounts(propertyIds: string[]) {
  return apiFetch<{ counts: Record<string, number> }>(
    "/action-requests/counts",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propertyIds }),
    }
  );
}
