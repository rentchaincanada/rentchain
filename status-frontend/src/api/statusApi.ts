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

export function readAdminToken() {
  const fromQuery = new URLSearchParams(window.location.search).get("adminToken");
  const token = String(fromQuery || localStorage.getItem("status_admin_token") || "").trim();
  if (fromQuery && token) {
    localStorage.setItem("status_admin_token", token);
  }
  return token || null;
}

export async function refreshAllStatusComponents(adminToken: string) {
  const url = `${getApiBase()}/api/admin/status/refresh-all`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
    },
  });
  if (!res.ok) {
    let payload: any = null;
    try {
      payload = await res.json();
    } catch {
      payload = null;
    }
    if (res.status === 409 && String(payload?.error || "") === "ACTIVE_INCIDENT_PRESENT") {
      throw new Error("ACTIVE_INCIDENT_PRESENT");
    }
    throw new Error(`status_refresh_all_${res.status}`);
  }
  return (await res.json()) as { ok: true; updatedComponents: number };
}
