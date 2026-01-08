import { apiFetch } from "./apiFetch";

export async function fetchActionRequestCounts(propertyIds: string[]) {
  try {
    return await apiFetch<{ counts: Record<string, number> }>(
      "/action-requests/counts",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyIds }),
      }
    );
  } catch (e: any) {
    const msg = String(e?.message || "");
    if (msg.includes("404")) {
      return { counts: {} };
    }
    throw e;
  }
}
