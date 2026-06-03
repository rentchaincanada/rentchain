import { db } from "../../firebase";
import { CURRENT_LEASE_STATUSES } from "../leaseCanonicalizationService";
import { loadPropertyLeaseIntegrityDiagnostics, reportTenantPointerIssues } from "../leaseIntegrityService";

type FirestoreLike = Pick<FirebaseFirestore.Firestore, "collection">;
type OverviewDoc = { id: string; raw: Record<string, unknown> };

export type AdminOverviewView = {
  summary: {
    totalProperties: number;
    totalUnits: number;
    totalTenants: number;
    totalLeases: number;
    activeLeases: number;
    integrityWarnings: number;
    orphanRecords: number;
  };
  activity: {
    recentAdminAccessCount: number;
    recentHighImpactEvents: Array<{
      key: string;
      label: string;
      ts: string | number | null;
    }>;
  };
  integrity: {
    orphanProperties: number;
    missingOwnerLinks: number;
    duplicateActiveLeases: number;
    staleLeasePointers: number;
    propertyUnitMismatches: number;
  };
};

function asTrimmedString(value: unknown): string {
  return String(value || "").trim();
}

function toTimestamp(value: unknown): string | number | null {
  if (typeof value === "number") return value;
  if (typeof value === "string") return value.trim() || null;
  if (typeof (value as any)?.toMillis === "function") return (value as any).toMillis();
  if (typeof (value as any)?.seconds === "number") return (value as any).seconds * 1000;
  return null;
}

function toEventLabel(raw: Record<string, unknown>) {
  const type = asTrimmedString(raw.type || raw.eventName) || "admin_event";
  return type
    .replace(/[_\.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function loadAdminOverview(options?: { firestore?: FirestoreLike }): Promise<AdminOverviewView> {
  const firestore = (options?.firestore || (db as any)) as FirestoreLike;

  const [propertiesSnap, unitsSnap, tenantsSnap, leasesSnap, telemetrySnap] = await Promise.all([
    firestore.collection("properties").get(),
    firestore.collection("units").get(),
    firestore.collection("tenants").get(),
    firestore.collection("leases").get(),
    firestore.collection("telemetry_events").get().catch(() => ({ docs: [] } as any)),
  ]);

  const propertyDocs: OverviewDoc[] = (propertiesSnap.docs || []).map((doc: any) => ({
    id: doc.id,
    raw: (doc.data() || {}) as Record<string, unknown>,
  }));
  const leaseDocs: OverviewDoc[] = (leasesSnap.docs || []).map((doc: any) => ({
    id: doc.id,
    raw: (doc.data() || {}) as Record<string, unknown>,
  }));
  const telemetryDocs: OverviewDoc[] = (telemetrySnap.docs || []).map((doc: any) => ({
    id: doc.id,
    raw: (doc.data() || {}) as Record<string, unknown>,
  }));

  let orphanProperties = 0;
  let missingOwnerLinks = 0;
  for (const property of propertyDocs) {
    const ownerUserId = asTrimmedString(property.raw.ownerUserId);
    const landlordId = asTrimmedString(property.raw.landlordId);
    const managerUserIds = Array.isArray(property.raw.managerUserIds) ? property.raw.managerUserIds.filter(Boolean) : [];
    if (!ownerUserId) missingOwnerLinks += 1;
    if (!ownerUserId && !landlordId && managerUserIds.length === 0) orphanProperties += 1;
  }

  const activeLeases = leaseDocs.filter((lease) => CURRENT_LEASE_STATUSES.has(asTrimmedString(lease.raw.status).toLowerCase())).length;

  let duplicateActiveLeases = 0;
  let propertyUnitMismatches = 0;
  let staleLeasePointers = 0;

  for (const property of propertyDocs) {
    const propertyId = property.id;
    const landlordId = asTrimmedString(property.raw.landlordId) || null;
    const [{ issues }, pointerIssues] = await Promise.all([
      loadPropertyLeaseIntegrityDiagnostics(propertyId, landlordId, firestore as any).catch(() => ({ issues: [] })),
      reportTenantPointerIssues(propertyId, landlordId, firestore as any).catch(() => []),
    ]);

    duplicateActiveLeases += issues.filter((issue) => issue.issueType === "duplicate_active_agreement_overlap").length;
    propertyUnitMismatches += issues.filter((issue) => issue.issueType === "unit_status_mismatch").length;
    staleLeasePointers += pointerIssues.filter((issue) => issue.issueType === "tenant_stale_currentLeaseId").length;
  }

  const recentAdminEvents = telemetryDocs
    .filter(({ raw }: OverviewDoc) => {
      const actor = asTrimmedString(raw.actor).toLowerCase();
      const role = asTrimmedString(raw.role).toLowerCase();
      return actor === "admin" || role === "admin";
    })
    .sort((a: OverviewDoc, b: OverviewDoc) => {
      const aTs = Number(toTimestamp(a.raw.ts ?? a.raw.createdAt) || 0);
      const bTs = Number(toTimestamp(b.raw.ts ?? b.raw.createdAt) || 0);
      return bTs - aTs;
    });

  const recentHighImpactEvents = recentAdminEvents.slice(0, 5).map(({ id, raw }: OverviewDoc) => ({
    key: id,
    label: toEventLabel(raw),
    ts: toTimestamp(raw.ts ?? raw.createdAt),
  }));

  const integrityWarnings =
    orphanProperties + missingOwnerLinks + duplicateActiveLeases + staleLeasePointers + propertyUnitMismatches;

  return {
    summary: {
      totalProperties: propertyDocs.length,
      totalUnits: unitsSnap.size || (unitsSnap.docs || []).length,
      totalTenants: tenantsSnap.size || (tenantsSnap.docs || []).length,
      totalLeases: leaseDocs.length,
      activeLeases,
      integrityWarnings,
      orphanRecords: orphanProperties,
    },
    activity: {
      recentAdminAccessCount: recentAdminEvents.length,
      recentHighImpactEvents,
    },
    integrity: {
      orphanProperties,
      missingOwnerLinks,
      duplicateActiveLeases,
      staleLeasePointers,
      propertyUnitMismatches,
    },
  };
}
