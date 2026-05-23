import { db } from "../../config/firebase";

type FirestoreLike = Pick<FirebaseFirestore.Firestore, "collection">;

export type AdminLeaseView = {
  id: string;
  leaseDisplayLabel: string;
  propertyId: string | null;
  propertyName: string | null;
  unitId: string | null;
  unitNumber: string | null;
  landlordId: string | null;
  landlordDisplayName: string | null;
  tenantIds: string[];
  tenantNames: string[];
  status: string | null;
  monthlyRent: number | null;
  startDate: string | null;
  endDate: string | null;
  riskGrade: string | null;
  createdAt: string | number | null;
  updatedAt: string | number | null;
  integrity: {
    hasIssues: boolean;
    duplicateAgreement: boolean;
    occupancyMismatch: boolean;
  };
};

export type AdminLeasesQuery = {
  q?: string | null;
  landlordId?: string | null;
  propertyId?: string | null;
  status?: string | null;
  riskGrade?: string | null;
  integrity?: "all" | "issues" | "duplicateAgreement" | "occupancyMismatch" | null;
  startAfter?: string | null;
  startBefore?: string | null;
  endAfter?: string | null;
  endBefore?: string | null;
  sortBy?: "createdAt" | "updatedAt" | "startDate" | "monthlyRent" | null;
  sortDir?: "asc" | "desc" | null;
  page?: number | null;
  pageSize?: number | null;
};

export type AdminLeasesResult = {
  items: AdminLeaseView[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
};

type LeaseDocRow = {
  id: string;
  raw: Record<string, unknown>;
};

function asTrimmedString(value: unknown): string {
  return String(value || "").trim();
}

function asLower(value: unknown): string {
  return asTrimmedString(value).toLowerCase();
}

function parsePage(input: number | null | undefined, fallback: number) {
  const next = Number(input ?? fallback);
  return Number.isFinite(next) && next > 0 ? Math.floor(next) : fallback;
}

function safeValue(value: unknown): string | number | null {
  if (typeof value === "number") return value;
  const next = asTrimmedString(value);
  return next || null;
}

function toNumber(value: unknown): number | null {
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

function toDateString(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number") return String(value);
  if (typeof (value as any)?.toMillis === "function") return new Date((value as any).toMillis()).toISOString();
  if (typeof (value as any)?.seconds === "number") return new Date((value as any).seconds * 1000).toISOString();
  return null;
}

function normalizeQuery(input?: AdminLeasesQuery) {
  return {
    q: asLower(input?.q) || null,
    landlordId: asTrimmedString(input?.landlordId) || null,
    propertyId: asTrimmedString(input?.propertyId) || null,
    status: asLower(input?.status) || null,
    riskGrade: asLower(input?.riskGrade) || null,
    integrity:
      input?.integrity === "issues" ||
      input?.integrity === "duplicateAgreement" ||
      input?.integrity === "occupancyMismatch"
        ? input.integrity
        : "all",
    startAfter: asTrimmedString(input?.startAfter) || null,
    startBefore: asTrimmedString(input?.startBefore) || null,
    endAfter: asTrimmedString(input?.endAfter) || null,
    endBefore: asTrimmedString(input?.endBefore) || null,
    sortBy:
      input?.sortBy === "createdAt" || input?.sortBy === "startDate" || input?.sortBy === "monthlyRent"
        ? input.sortBy
        : "updatedAt",
    sortDir: input?.sortDir === "asc" ? "asc" : "desc",
    page: parsePage(input?.page, 1),
    pageSize: Math.min(parsePage(input?.pageSize, 25), 100),
  } as const;
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

function tenantIdsFromLease(raw: Record<string, unknown>): string[] {
  const fromArray = Array.isArray(raw.tenantIds)
    ? raw.tenantIds.map((value) => asTrimmedString(value)).filter(Boolean)
    : [];
  const singles = [raw.tenantId, raw.primaryTenantId].map((value) => asTrimmedString(value)).filter(Boolean);
  return Array.from(new Set([...fromArray, ...singles]));
}

function computeIntegrity(raw: Record<string, unknown>) {
  const duplicateAgreement =
    raw.duplicateAgreement === true ||
    raw.agreementConflict === true ||
    asLower(raw.integrityIssue) === "duplicate_agreement";
  const occupancyMismatch =
    raw.occupancyMismatch === true ||
    raw.unitOccupancyMismatch === true ||
    asLower(raw.integrityIssue) === "occupancy_mismatch";
  return {
    hasIssues: duplicateAgreement || occupancyMismatch,
    duplicateAgreement,
    occupancyMismatch,
  };
}

function safeLandlordDisplayName(record: Record<string, unknown> | null | undefined): string | null {
  return (
    asTrimmedString(record?.businessName) ||
    asTrimmedString(record?.companyName) ||
    asTrimmedString(record?.displayName) ||
    asTrimmedString(record?.name) ||
    null
  );
}

function buildLeaseDisplayLabel(input: {
  propertyName: string | null;
  unitNumber: string | null;
  tenantNames: string[];
}): string {
  const property = input.propertyName || "Property not linked";
  const unit = input.unitNumber ? `Unit ${input.unitNumber}` : "Unit not assigned";
  const tenant = input.tenantNames[0] || "Tenant not linked";
  return `${property} · ${unit} · ${tenant}`;
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

function buildView(
  lease: LeaseDocRow,
  propertiesById: Map<string, Record<string, unknown>>,
  tenantsById: Map<string, Record<string, unknown>>,
  landlordsById: Map<string, Record<string, unknown>>
): AdminLeaseView {
  const raw = lease.raw;
  const propertyId = asTrimmedString(raw.propertyId) || null;
  const property = propertyId ? propertiesById.get(propertyId) : null;
  const landlordId = asTrimmedString(raw.landlordId) || null;
  const landlord = landlordId ? landlordsById.get(landlordId) : null;
  const tenantIds = tenantIdsFromLease(raw);
  const tenantNames = tenantIds
    .map((tenantId) => {
      const tenant = tenantsById.get(tenantId);
      return asTrimmedString(tenant?.fullName || tenant?.name || [tenant?.firstName, tenant?.lastName].filter(Boolean).join(" "));
    })
    .filter(Boolean);
  const integrity = computeIntegrity(raw);
  const propertyName =
    asTrimmedString(property?.name) ||
    asTrimmedString(raw.propertyName || raw.propertyLabel) ||
    null;
  const unitNumber = asTrimmedString(raw.unitNumber || raw.unitLabel || raw.unit) || null;
  const landlordDisplayName = safeLandlordDisplayName(landlord) || "Landlord account";

  return {
    id: lease.id,
    leaseDisplayLabel: buildLeaseDisplayLabel({ propertyName, unitNumber, tenantNames }),
    propertyId,
    propertyName,
    unitId: asTrimmedString(raw.unitId) || null,
    unitNumber,
    landlordId,
    landlordDisplayName,
    tenantIds,
    tenantNames,
    status: asTrimmedString(raw.status) || null,
    monthlyRent: toNumber(raw.monthlyRent ?? raw.currentRent ?? raw.rent ?? raw.rentAmount),
    startDate: toDateString(raw.leaseStartDate ?? raw.startDate ?? raw.leaseStart),
    endDate: toDateString(raw.leaseEndDate ?? raw.endDate ?? raw.leaseEnd),
    riskGrade: asTrimmedString(raw.riskGrade || (raw.risk as any)?.grade) || null,
    createdAt: safeValue(raw.createdAt ?? raw.created_at),
    updatedAt: safeValue(raw.updatedAt ?? raw.updated_at),
    integrity,
  };
}

function matchesDateRange(value: string | null, after: string | null, before: string | null) {
  if (!value) return !after && !before;
  if (after && value < after) return false;
  if (before && value > before) return false;
  return true;
}

function matchesSearch(view: AdminLeaseView, q: string | null) {
  if (!q) return true;
  const haystack = [
    view.id,
    view.leaseDisplayLabel,
    view.propertyName,
    view.unitNumber,
    view.landlordDisplayName,
    ...view.tenantNames,
  ]
    .map((value) => asLower(value))
    .filter(Boolean)
    .join(" ");
  return haystack.includes(q);
}

export async function listAdminLeases(
  input?: AdminLeasesQuery & { firestore?: FirestoreLike }
): Promise<AdminLeasesResult> {
  const firestore = (input?.firestore || (db as any)) as FirestoreLike;
  const query = normalizeQuery(input);

  let leasesQuery: FirebaseFirestore.Query = firestore.collection("leases");
  if (query.landlordId) {
    leasesQuery = leasesQuery.where("landlordId", "==", query.landlordId);
  }
  if (query.propertyId) {
    leasesQuery = leasesQuery.where("propertyId", "==", query.propertyId);
  }

  const snap = await leasesQuery.get();
  const leaseDocs: LeaseDocRow[] = (snap.docs || []).map((doc: any) => ({
    id: doc.id,
    raw: (doc.data() || {}) as Record<string, unknown>,
  }));

  const propertyIds = Array.from(new Set(leaseDocs.map((lease) => asTrimmedString(lease.raw.propertyId)).filter(Boolean)));
  const tenantIds = Array.from(new Set(leaseDocs.flatMap((lease) => tenantIdsFromLease(lease.raw))));
  const landlordIds = Array.from(new Set(leaseDocs.map((lease) => asTrimmedString(lease.raw.landlordId)).filter(Boolean)));
  const [propertiesById, tenantsById, landlordsById] = await Promise.all([
    loadLinkedDocs(firestore, "properties", propertyIds),
    loadLinkedDocs(firestore, "tenants", tenantIds),
    loadLinkedDocs(firestore, "landlords", landlordIds),
  ]);

  const allViews = leaseDocs.map((lease) => buildView(lease, propertiesById, tenantsById, landlordsById));

  const filtered = allViews.filter((view) => {
    if (!matchesSearch(view, query.q)) return false;
    if (query.status && asLower(view.status) !== query.status) return false;
    if (query.riskGrade && asLower(view.riskGrade) !== query.riskGrade) return false;
    if (!matchesDateRange(view.startDate, query.startAfter, query.startBefore)) return false;
    if (!matchesDateRange(view.endDate, query.endAfter, query.endBefore)) return false;
    if (query.integrity === "issues" && !view.integrity.hasIssues) return false;
    if (query.integrity === "duplicateAgreement" && !view.integrity.duplicateAgreement) return false;
    if (query.integrity === "occupancyMismatch" && !view.integrity.occupancyMismatch) return false;
    return true;
  });

  filtered.sort((a, b) => {
    const aValue =
      query.sortBy === "createdAt"
        ? a.createdAt
        : query.sortBy === "startDate"
        ? a.startDate
        : query.sortBy === "monthlyRent"
        ? a.monthlyRent
        : a.updatedAt;
    const bValue =
      query.sortBy === "createdAt"
        ? b.createdAt
        : query.sortBy === "startDate"
        ? b.startDate
        : query.sortBy === "monthlyRent"
        ? b.monthlyRent
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
