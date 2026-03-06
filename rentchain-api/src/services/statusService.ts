import { db } from "../config/firebase";

export type PublicStatusLevel =
  | "operational"
  | "degraded"
  | "partial_outage"
  | "major_outage";

export type IncidentState = "investigating" | "identified" | "monitoring" | "resolved";
export type IncidentSeverity = "minor" | "major" | "critical";

const STATUS_META_DOC = "global";
const COMPONENTS = [
  { key: "website", name: "Website / Frontend" },
  { key: "api", name: "API" },
  { key: "applications", name: "Tenant Applications" },
  { key: "screening", name: "Credit Screening" },
  { key: "payments", name: "Payments" },
  { key: "email", name: "Email Notifications" },
  { key: "reports", name: "Reports / Documents" },
];

function nowMs() {
  return Date.now();
}

function asStatus(value: unknown): PublicStatusLevel {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "degraded") return "degraded";
  if (raw === "partial_outage") return "partial_outage";
  if (raw === "major_outage") return "major_outage";
  return "operational";
}

function asIncidentState(value: unknown): IncidentState {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "identified") return "identified";
  if (raw === "monitoring") return "monitoring";
  if (raw === "resolved") return "resolved";
  return "investigating";
}

function asIncidentSeverity(value: unknown): IncidentSeverity {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "major") return "major";
  if (raw === "critical") return "critical";
  return "minor";
}

function asMs(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.round(parsed);
  }
  return null;
}

export async function getPublicStatusPayload() {
  const [metaSnap, componentsSnap, incidentsSnap] = await Promise.all([
    db.collection("statusMeta").doc(STATUS_META_DOC).get(),
    db.collection("statusComponents").get(),
    db.collection("statusIncidents").orderBy("createdAtMs", "desc").limit(10).get(),
  ]);

  const meta = metaSnap.exists ? (metaSnap.data() as any) : {};
  const byKey = new Map<string, any>();
  componentsSnap.forEach((doc) => {
    byKey.set(doc.id, { id: doc.id, ...(doc.data() as any) });
  });

  const components = COMPONENTS.map((item) => {
    const current = byKey.get(item.key) || {};
    return {
      key: item.key,
      name: String(current.name || item.name),
      status: asStatus(current.status),
      message: String(current.message || ""),
      updatedAtMs: asMs(current.updatedAtMs) || null,
    };
  });

  const incidents = incidentsSnap.docs.map((doc) => {
    const data = doc.data() as any;
    return {
      id: doc.id,
      title: String(data.title || "Incident"),
      status: asIncidentState(data.status),
      severity: asIncidentSeverity(data.severity),
      message: String(data.message || ""),
      createdAtMs: asMs(data.createdAtMs) || nowMs(),
      updatedAtMs: asMs(data.updatedAtMs) || null,
      resolvedAtMs: asMs(data.resolvedAtMs),
    };
  });

  return {
    ok: true,
    overallStatus: asStatus(meta.overallStatus),
    activeBanner:
      meta.activeBannerTitle || meta.activeBannerMessage
        ? {
            title: String(meta.activeBannerTitle || ""),
            message: String(meta.activeBannerMessage || ""),
          }
        : null,
    maintenanceBanner:
      meta.maintenanceTitle || meta.maintenanceMessage
        ? {
            title: String(meta.maintenanceTitle || ""),
            message: String(meta.maintenanceMessage || ""),
          }
        : null,
    components,
    incidents,
    updatedAtMs: asMs(meta.updatedAtMs) || nowMs(),
  };
}

export async function updateStatusMeta(input: any) {
  const payload = {
    overallStatus: asStatus(input?.overallStatus),
    activeBannerTitle: String(input?.activeBannerTitle || ""),
    activeBannerMessage: String(input?.activeBannerMessage || ""),
    maintenanceTitle: String(input?.maintenanceTitle || ""),
    maintenanceMessage: String(input?.maintenanceMessage || ""),
    updatedAtMs: nowMs(),
  };
  await db.collection("statusMeta").doc(STATUS_META_DOC).set(payload, { merge: true });
  return payload;
}

export async function updateStatusComponent(input: any) {
  const key = String(input?.key || "").trim().toLowerCase();
  if (!key) throw new Error("missing_component_key");
  const fallback = COMPONENTS.find((item) => item.key === key)?.name || key;
  const payload = {
    key,
    name: String(input?.name || fallback),
    status: asStatus(input?.status),
    message: String(input?.message || ""),
    updatedAtMs: nowMs(),
  };
  await db.collection("statusComponents").doc(key).set(payload, { merge: true });
  return payload;
}

export async function createStatusIncident(input: any) {
  const payload = {
    title: String(input?.title || "Incident"),
    status: asIncidentState(input?.status),
    severity: asIncidentSeverity(input?.severity),
    message: String(input?.message || ""),
    createdAtMs: nowMs(),
    updatedAtMs: nowMs(),
    resolvedAtMs: null as number | null,
  };
  const ref = await db.collection("statusIncidents").add(payload);
  return { id: ref.id, ...payload };
}

export async function resolveStatusIncident(id: string, message?: string) {
  const trimmed = String(id || "").trim();
  if (!trimmed) throw new Error("missing_incident_id");
  const payload = {
    status: "resolved" as IncidentState,
    message: String(message || ""),
    updatedAtMs: nowMs(),
    resolvedAtMs: nowMs(),
  };
  await db.collection("statusIncidents").doc(trimmed).set(payload, { merge: true });
  return { id: trimmed, ...payload };
}
