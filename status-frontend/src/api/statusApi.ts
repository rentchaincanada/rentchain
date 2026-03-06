export type PublicStatusLevel = "operational" | "degraded" | "partial_outage" | "major_outage";

export type StatusComponent = {
  key: string;
  name: string;
  status: PublicStatusLevel;
  message: string;
  updatedAtMs: number | null;
};

export type StatusIncident = {
  id: string;
  title: string;
  status: "investigating" | "identified" | "monitoring" | "resolved";
  severity: "minor" | "major" | "critical";
  message: string;
  createdAtMs: number;
  updatedAtMs: number | null;
  resolvedAtMs: number | null;
};

export type PublicStatusPayload = {
  ok: true;
  overallStatus: PublicStatusLevel;
  activeBanner: { title: string; message: string } | null;
  maintenanceBanner: { title: string; message: string } | null;
  components: StatusComponent[];
  incidents: StatusIncident[];
  updatedAtMs: number;
};

function getApiBase() {
  const explicit = String(import.meta.env.VITE_STATUS_API_BASE || "").trim();
  if (explicit) return explicit.replace(/\/$/, "");
  return "https://rentchain-landlord-api-915921057662.us-central1.run.app";
}

export async function fetchPublicStatus() {
  const url = `${getApiBase()}/api/status/public`;
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) throw new Error(`status_api_${res.status}`);
  return (await res.json()) as PublicStatusPayload;
}
