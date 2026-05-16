import { db } from "../../config/firebase";
import {
  deriveTenantLifecycle,
  type TenantLifecycleResult,
} from "../../lib/tenants/deriveTenantLifecycle";

type FirestoreLike = Pick<FirebaseFirestore.Firestore, "collection">;

export type AdminTenantView = {
  id: string;
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  landlordId: string | null;
  propertyId: string | null;
  propertyName: string | null;
  unitId: string | null;
  unitNumber: string | null;
  leaseId: string | null;
  leaseStatus: string | null;
  screeningStatus: string | null;
  moveInStatus: string | null;
  currentLeaseStartDate: string | null;
  currentLeaseEndDate: string | null;
  createdAt: string | number | null;
  updatedAt: string | number | null;
  lifecycle: TenantLifecycleResult;
  flags: {
    missingLeaseLink: boolean;
    missingPropertyLink: boolean;
    hasScreening: boolean;
  };
};

export type AdminTenantsQuery = {
  q?: string | null;
  landlordId?: string | null;
  propertyId?: string | null;
  leaseStatus?: string | null;
  screeningStatus?: string | null;
  moveInStatus?: string | null;
  sortBy?: "createdAt" | "updatedAt" | "fullName" | null;
  sortDir?: "asc" | "desc" | null;
  page?: number | null;
  pageSize?: number | null;
};

export type AdminTenantsResult = {
  items: AdminTenantView[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
};

type TenantDocRow = {
  id: string;
  raw: Record<string, unknown>;
};

type LeaseLink = {
  id: string;
  raw: Record<string, unknown>;
} | null;

function asTrimmedString(value: unknown): string {
  return String(value || "").trim();
}

function asLower(value: unknown): string {
  return asTrimmedString(value).toLowerCase();
}

function normalizeDate(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number") return String(value);
  if (typeof (value as any)?.toMillis === "function") {
    return new Date((value as any).toMillis()).toISOString();
  }
  if (typeof (value as any)?.seconds === "number") {
    return new Date((value as any).seconds * 1000).toISOString();
  }
  return null;
}

function safeValue(value: unknown): string | number | null {
  if (typeof value === "number") return value;
  const next = asTrimmedString(value);
  return next || null;
}

function parsePage(input: number | null | undefined, fallback: number) {
  const next = Number(input ?? fallback);
  return Number.isFinite(next) && next > 0 ? Math.floor(next) : fallback;
}

function normalizeQuery(input?: AdminTenantsQuery) {
  return {
    q: asLower(input?.q) || null,
    landlordId: asTrimmedString(input?.landlordId) || null,
    propertyId: asTrimmedString(input?.propertyId) || null,
    leaseStatus: asLower(input?.leaseStatus) || null,
    screeningStatus: asLower(input?.screeningStatus) || null,
    moveInStatus: asLower(input?.moveInStatus) || null,
    sortBy: input?.sortBy === "createdAt" || input?.sortBy === "fullName" ? input.sortBy : "updatedAt",
    sortDir: input?.sortDir === "asc" ? "asc" : "desc",
    page: parsePage(input?.page, 1),
    pageSize: Math.min(parsePage(input?.pageSize, 25), 100),
  } as const;
}

function nameParts(raw: Record<string, unknown>) {
  const firstName = asTrimmedString(raw.firstName || raw.givenName) || null;
  const lastName = asTrimmedString(raw.lastName || raw.familyName) || null;
  const fullName =
    asTrimmedString(raw.fullName || raw.name) ||
    [firstName, lastName].filter(Boolean).join(" ").trim() ||
    null;
  return { firstName, lastName, fullName };
}

function unitLabel(raw: Record<string, unknown>) {
  return (
    asTrimmedString(raw.unitNumber) ||
    asTrimmedString(raw.unitLabel) ||
    asTrimmedString(raw.unit) ||
    null
  );
}

function screeningStatus(raw: Record<string, unknown>) {
  return (
    asTrimmedString(raw.screeningStatus) ||
    asTrimmedString((raw.screening as any)?.status) ||
    null
  );
}

function moveInStatus(raw: Record<string, unknown>) {
  return (
    asTrimmedString(raw.moveInStatus) ||
    asTrimmedString((raw.moveIn as any)?.status) ||
    null
  );
}

function leaseStatus(raw: Record<string, unknown>) {
  return asTrimmedString(raw.leaseStatus || raw.status) || null;
}

function compareValues(a: string | number | null, b: string | number | null, dir: "asc" | "desc") {
  const aValue = a ?? "";
  const bValue = b ?? "";
  const result =
    typeof aValue === "number" && typeof bValue === "number"
      ? aValue - bValue
      : String(aValue).localeCompare(String(bValue), undefined, { sensitivity: "base" });
  return dir === "asc" ? result : -result;
}

async function loadLinkedDocs(
  firestore: FirestoreLike,
  collectionName: string,
  ids: string[]
): Promise<Map<string, Record<string, unknown>>> {
  const out = new Map<string, Record<string, unknown>>();
  await Promise.all(
    ids.map(async (id) => {
      const trimmed = asTrimmedString(id);
      if (!trimmed) return;
      const snap = await (firestore.collection(collectionName) as any).doc(trimmed).get().catch(() => null);
      if (snap?.exists) out.set(trimmed, (snap.data() || {}) as Record<string, unknown>);
    })
  );
  return out;
}

function resolveLeaseLink(
  tenant: TenantDocRow,
  leasesById: Map<string, Record<string, unknown>>
): LeaseLink {
  const leaseId = asTrimmedString(tenant.raw.currentLeaseId || tenant.raw.leaseId);
  if (!leaseId) return null;
  const raw = leasesById.get(leaseId);
  if (!raw) return null;

  const tenantLandlordId = asTrimmedString(tenant.raw.landlordId);
  const leaseLandlordId = asTrimmedString(raw.landlordId);
  if (tenantLandlordId && leaseLandlordId && tenantLandlordId !== leaseLandlordId) return null;

  const tenantPropertyId = asTrimmedString(tenant.raw.propertyId);
  const leasePropertyId = asTrimmedString(raw.propertyId);
  if (tenantPropertyId && leasePropertyId && tenantPropertyId !== leasePropertyId) return null;

  const tenantUnitId = asTrimmedString(tenant.raw.unitId);
  const leaseUnitId = asTrimmedString(raw.unitId);
  if (tenantUnitId && leaseUnitId && tenantUnitId !== leaseUnitId) return null;

  return { id: leaseId, raw };
}

function buildView(
  tenant: TenantDocRow,
  leasesById: Map<string, Record<string, unknown>>,
  propertiesById: Map<string, Record<string, unknown>>
): AdminTenantView {
  const names = nameParts(tenant.raw);
  const linkedLease = resolveLeaseLink(tenant, leasesById);

  const propertyId =
    asTrimmedString(tenant.raw.propertyId) ||
    asTrimmedString(linkedLease?.raw.propertyId) ||
    null;
  const property = propertyId ? propertiesById.get(propertyId) : null;
  const propertyName =
    asTrimmedString(property?.name) ||
    asTrimmedString(tenant.raw.propertyName || tenant.raw.property) ||
    asTrimmedString(linkedLease?.raw.propertyLabel) ||
    null;

  const leaseId = linkedLease?.id || null;
  const currentLeaseStatus =
    leaseStatus((linkedLease?.raw || {}) as Record<string, unknown>) ||
    leaseStatus(tenant.raw) ||
    null;
  const currentScreeningStatus = screeningStatus(tenant.raw);
  const currentMoveInStatus = moveInStatus(tenant.raw);
  const lifecycle = deriveTenantLifecycle({
    tenantStatus: tenant.raw.status,
    applicantStatus: tenant.raw.applicantStatus || tenant.raw.applicationStatus,
    screeningStatus: currentScreeningStatus,
    leaseStatus: currentLeaseStatus,
    occupancyStatus: currentMoveInStatus || tenant.raw.occupancyStatus,
    currentLeaseId: tenant.raw.currentLeaseId || tenant.raw.leaseId,
    leaseId,
    applicationId: tenant.raw.applicationId || tenant.raw.sourceApplication,
    tenantId: tenant.id,
    source: tenant.raw.source,
    archivedAt: tenant.raw.archivedAt || linkedLease?.raw.archivedAt,
    isArchived: tenant.raw.isArchived || linkedLease?.raw.isArchived,
    hiddenFromActiveLists: tenant.raw.hiddenFromActiveLists,
  });

  return {
    id: tenant.id,
    fullName: names.fullName,
    firstName: names.firstName,
    lastName: names.lastName,
    email: asTrimmedString(tenant.raw.email) || null,
    phone: asTrimmedString(tenant.raw.phone) || null,
    landlordId: asTrimmedString(tenant.raw.landlordId) || asTrimmedString(linkedLease?.raw.landlordId) || null,
    propertyId,
    propertyName,
    unitId: asTrimmedString(tenant.raw.unitId) || asTrimmedString(linkedLease?.raw.unitId) || null,
    unitNumber:
      unitLabel(tenant.raw) ||
      unitLabel((linkedLease?.raw || {}) as Record<string, unknown>) ||
      null,
    leaseId,
    leaseStatus: currentLeaseStatus,
    screeningStatus: currentScreeningStatus,
    moveInStatus: currentMoveInStatus,
    currentLeaseStartDate:
      normalizeDate(linkedLease?.raw.leaseStartDate) ||
      normalizeDate(linkedLease?.raw.leaseStart) ||
      normalizeDate(tenant.raw.leaseStart),
    currentLeaseEndDate:
      normalizeDate(linkedLease?.raw.leaseEndDate) ||
      normalizeDate(linkedLease?.raw.leaseEnd) ||
      normalizeDate(tenant.raw.leaseEnd),
    createdAt: safeValue(tenant.raw.createdAt ?? tenant.raw.created_at),
    updatedAt: safeValue(tenant.raw.updatedAt ?? tenant.raw.updated_at),
    lifecycle,
    flags: {
      missingLeaseLink: !!asTrimmedString(tenant.raw.currentLeaseId || tenant.raw.leaseId) && !linkedLease,
      missingPropertyLink: !propertyId || !propertyName,
      hasScreening: !!currentScreeningStatus,
    },
  };
}

function matchesSearch(view: AdminTenantView, q: string | null) {
  if (!q) return true;
  const haystack = [
    view.id,
    view.fullName,
    view.firstName,
    view.lastName,
    view.email,
    view.phone,
    view.propertyName,
    view.unitNumber,
  ]
    .map((value) => asLower(value))
    .filter(Boolean)
    .join(" ");
  return haystack.includes(q);
}

export async function listAdminTenants(
  input?: AdminTenantsQuery & { firestore?: FirestoreLike }
): Promise<AdminTenantsResult> {
  const firestore = (input?.firestore || (db as any)) as FirestoreLike;
  const query = normalizeQuery(input);

  let tenantsQuery: FirebaseFirestore.Query = firestore.collection("tenants");
  if (query.landlordId) {
    tenantsQuery = tenantsQuery.where("landlordId", "==", query.landlordId);
  }

  const snap = await tenantsQuery.get();
  const tenantDocs: TenantDocRow[] = (snap.docs || []).map((doc: any) => ({
    id: doc.id,
    raw: (doc.data() || {}) as Record<string, unknown>,
  }));

  const leaseIds = Array.from(
    new Set(
      tenantDocs
        .map((tenant) => asTrimmedString(tenant.raw.currentLeaseId || tenant.raw.leaseId))
        .filter(Boolean)
    )
  );
  const leasesById = await loadLinkedDocs(firestore, "leases", leaseIds);

  const propertyIds = Array.from(
    new Set(
      tenantDocs
        .map((tenant) => {
          const linkedLease = resolveLeaseLink(tenant, leasesById);
          return asTrimmedString(tenant.raw.propertyId || linkedLease?.raw.propertyId);
        })
        .filter(Boolean)
    )
  );
  const propertiesById = await loadLinkedDocs(firestore, "properties", propertyIds);

  const allViews = tenantDocs.map((tenant) => buildView(tenant, leasesById, propertiesById));

  const filtered = allViews.filter((view) => {
    if (!matchesSearch(view, query.q)) return false;
    if (query.propertyId && view.propertyId !== query.propertyId) return false;
    if (query.leaseStatus && asLower(view.leaseStatus) !== query.leaseStatus) return false;
    if (query.screeningStatus && asLower(view.screeningStatus) !== query.screeningStatus) return false;
    if (query.moveInStatus && asLower(view.moveInStatus) !== query.moveInStatus) return false;
    return true;
  });

  filtered.sort((a, b) => {
    const aValue =
      query.sortBy === "fullName"
        ? a.fullName
        : query.sortBy === "createdAt"
        ? a.createdAt
        : a.updatedAt;
    const bValue =
      query.sortBy === "fullName"
        ? b.fullName
        : query.sortBy === "createdAt"
        ? b.createdAt
        : b.updatedAt;
    return compareValues(aValue, bValue, query.sortDir);
  });

  const total = filtered.length;
  const startIndex = (query.page - 1) * query.pageSize;
  const items = filtered.slice(startIndex, startIndex + query.pageSize);

  return {
    items,
    page: query.page,
    pageSize: query.pageSize,
    total,
    hasMore: startIndex + query.pageSize < total,
  };
}
