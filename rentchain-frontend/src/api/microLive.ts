export type MicroLiveStep = { key: string; label: string };

export type MicroLiveStatus = {
  ok: boolean;
  landlordId: string;
  steps: MicroLiveStep[];
  completed: Record<string, boolean>;
  completedCount: number;
  total: number;
  updatedAt?: number | null;
};

export async function fetchMicroLiveStatus(): Promise<MicroLiveStatus> {
  const r = await fetch("/api/landlord/micro-live/status", {
    headers: { "Content-Type": "application/json" },
  });
  const j = await r.json();
  if (!r.ok || !j.ok) throw new Error(j.error || "Failed to load Micro-Live status");
  return j;
}

export async function completeMicroLiveStep(stepKey: string) {
  const r = await fetch("/api/landlord/micro-live/complete-step", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stepKey }),
  });
  const j = await r.json();
  if (!r.ok || !j.ok) throw new Error(j.error || "Failed to complete step");
  return j;
}
