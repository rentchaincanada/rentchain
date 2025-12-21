import { withAuthHeaders } from "./httpClient";

export async function fetchScreeningById(screeningId: string) {
  const res = await fetch(
    `/api/screenings/detail/${encodeURIComponent(screeningId)}`,
    withAuthHeaders({
      method: "GET",
      headers: { "Content-Type": "application/json" },
    })
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.message || "Failed to load screening");
  }
  return data as {
    id: string;
    provider: string;
    status: string;
    requestedAt: string;
    completedAt?: string;
    resultSummary?: { score?: number; riskLevel?: string; notes?: string };
    error?: { code: string; message: string };
  };
}
