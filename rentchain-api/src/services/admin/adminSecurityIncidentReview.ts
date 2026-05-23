import { db } from "../../config/firebase";
import {
  buildAdminSecurityIncidentReviewDetail,
  buildAdminSecurityIncidentReviewRecord,
  filterAdminSecurityIncidentRecords,
  type AdminSecurityIncidentReviewDetail,
  type AdminSecurityIncidentReviewRecord,
} from "../../lib/adminSecurityIncidents/adminSecurityIncidentReview";

type LoadParams = {
  category?: string | null;
  severity?: string | null;
  status?: string | null;
  q?: string | null;
  limit?: number | null;
};

async function loadCollection(collectionName: "telemetry_events" | "events", limit = 100) {
  const snap = await db.collection(collectionName).get().catch(() => null);
  return (snap?.docs || []).slice(0, limit).map((doc: any) => ({
    sourceCollection: collectionName,
    documentId: String(doc.id || ""),
    data: { id: doc.id, ...((doc.data() as Record<string, unknown>) || {}) },
  }));
}

export async function loadAdminSecurityIncidentReviews(
  params: LoadParams = {}
): Promise<{
  incidents: AdminSecurityIncidentReviewRecord[];
  summary: {
    total: number;
    open: number;
    reviewing: number;
    highOrCritical: number;
    metadataOnly: true;
  };
}> {
  const requestedLimit = Number(params.limit || 50);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 50;
  const [telemetry, auditEvents] = await Promise.all([loadCollection("telemetry_events"), loadCollection("events")]);
  const incidents = [...telemetry, ...auditEvents]
    .map((item) => buildAdminSecurityIncidentReviewRecord(item))
    .filter(Boolean) as AdminSecurityIncidentReviewRecord[];

  const filtered = filterAdminSecurityIncidentRecords(incidents, params)
    .sort((a, b) => Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt) || a.incidentId.localeCompare(b.incidentId))
    .slice(0, limit);

  return {
    incidents: filtered,
    summary: {
      total: filtered.length,
      open: filtered.filter((incident) => incident.status === "open").length,
      reviewing: filtered.filter((incident) => incident.status === "reviewing").length,
      highOrCritical: filtered.filter((incident) => incident.severity === "high" || incident.severity === "critical").length,
      metadataOnly: true,
    },
  };
}

export async function loadAdminSecurityIncidentReviewDetail(
  incidentId: string
): Promise<AdminSecurityIncidentReviewDetail | null> {
  const { incidents } = await loadAdminSecurityIncidentReviews({ limit: 100 });
  const incident = incidents.find((item) => item.incidentId === incidentId);
  return incident ? buildAdminSecurityIncidentReviewDetail(incident) : null;
}

