export type AdminMicroLiveMetrics = {
  ok: boolean;
  days: number;
  counters: Record<string, number>;
  enabledLandlordsInSample: number;
  enabledLandlordIds: string[];
};

export async function fetchAdminMicroLiveMetrics(days = 7): Promise<AdminMicroLiveMetrics> {
  const r = await fetch(`/api/admin/micro-live/metrics?days=${encodeURIComponent(String(days))}`);
  const j = await r.json();
  if (!r.ok || !j.ok) throw new Error(j.error || "Failed to load Micro-Live metrics");
  return j;
}
