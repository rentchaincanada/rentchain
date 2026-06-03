import { db } from "../../firebase";
import {
  deriveTenantLifecycle,
  type TenantLifecycleResult,
} from "../../lib/tenants/deriveTenantLifecycle";
import {
  loadUnitsForProperty,
  resolveUnitReference,
  toCanonicalLeaseRecord,
  toCanonicalUnitRecord,
  type CanonicalUnitRecord,
} from "../leaseCanonicalizationService";

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

type LeaseDocRow = {
  id: string;
  raw: Record<string, unknown>;
};

function unitScopeKey(propertyId: string | null | undefined, landlordId: string | null | undefined): string {
  return `${asTrimmedString(propertyId)}::${asTrimmedString(landlordId)}`;
}

function mergeUnits(...groups: CanonicalUnitRecord[][]): CanonicalUnitRecord[] {
  const out = new Map<string, CanonicalUnitRecord>();
  for (const group of groups) {
    for (const unit of group) {
      if (!out.has(unit.id)) out.set(unit.id, unit);
    }
  }
  return Array.from(out.values());
}

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
    normalizeUnitDisplayValue(raw.unitNumber) ||
    normalizeUnitDisplayValue(raw.unitLabel) ||
    normalizeUnitDisplayValue(raw.unit) ||
    null
  );
}

function normalizeUnitDisplayValue(value: unknown): string | null {
  const next = asTrimmedString(value);
  if (!next) return null;
  return next.replace(/^unit\s+/i, "").trim() || null;
}

function isLikelyRawInternalId(value: string | null, knownId?: string | null): boolean {
  const normalized = asTrimmedString(value);
  if (!normalized) return false;
  if (knownId && normalized === asTrimmedString(knownId)) return true;
  return /^[A-Za-z0-9_-]{16,}$/.test(normalized) && !/\s/.test(normalized);
}

function canonicalUnitLabel(unit?: CanonicalUnitRecord | null): string | null {
  if (!unit) return null;
  const candidates = [
    unit.unitNumber,
    unit.label,
    unit.raw?.unitNumber,
    unit.raw?.unitLabel,
    unit.raw?.label,
    unit.raw?.name,
    unit.raw?.unit,
  ]
    .map((value) => normalizeUnitDisplayValue(value))
    .filter(Boolean);
  for (const candidate of candidates) {
    if (!isLikelyRawInternalId(candidate, unit.id)) return candidate;
  }
  return null;
}

function resolveUnitDisplayFromPropertyUnits(
  raw: Record<string, unknown>,
  propertyUnits: CanonicalUnitRecord[]
): string | null {
  const references = [raw.unitId, raw.resolvedUnitId, raw.unitNumber, raw.unitLabel, raw.unit]
    .map((value) => asTrimmedString(value))
    .filter(Boolean);
  for (const reference of references) {
    const resolution = resolveUnitReference(propertyUnits, reference);
    if (!resolution.ambiguous && resolution.unit) {
      const label = canonicalUnitLabel(resolution.unit);
      if (label) return label;
    }
    const exactUnit = propertyUnits.find((unit) =>
      [unit.id, unit.raw?.unitId, unit.raw?.uid, unit.raw?.id]
        .map((value) => asTrimmedString(value))
        .filter(Boolean)
        .includes(reference)
    );
    const exactLabel = canonicalUnitLabel(exactUnit);
    if (exactLabel) return exactLabel;
  }
  return null;
}

function safeUnitLabel(raw: Record<string, unknown>, propertyUnits: CanonicalUnitRecord[]) {
  const unitId = asTrimmedString(raw.unitId) || asTrimmedString(raw.resolvedUnitId) || null;
  const rawLabel = unitLabel(raw);
  if (rawLabel && !isLikelyRawInternalId(rawLabel, unitId)) return rawLabel;
  return resolveUnitDisplayFromPropertyUnits(raw, propertyUnits);
}

function sanitizeUnitNumber(value: string | null, unitId: string | null): string | null {
  const normalized = normalizeUnitDisplayValue(value);
  return normalized && !isLikelyRawInternalId(normalized, unitId) ? normalized : null;
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

function isCurrentLeaseStatus(value: unknown) {
  const normalized = asLower(value);
  return ["active", "current", "notice_pending", "renewal_pending", "renewal_accepted", "move_out_pending"].includes(normalized);
}

function leaseStart(raw: Record<string, unknown>) {
  return normalizeDate(raw.leaseStartDate) || normalizeDate(raw.startDate) || normalizeDate(raw.leaseStart);
}

function leaseEnd(raw: Record<string, unknown>) {
  return normalizeDate(raw.leaseEndDate) || normalizeDate(raw.endDate) || normalizeDate(raw.leaseEnd);
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

async function loadUnitsByReferences(
  firestore: FirestoreLike,
  references: string[]
): Promise<Map<string, CanonicalUnitRecord[]>> {
  const out = new Map<string, CanonicalUnitRecord[]>();
  const uniqueReferences = Array.from(new Set(references.map((value) => asTrimmedString(value)).filter(Boolean)));
  await Promise.all(
    uniqueReferences.map(async (reference) => {
      const rows: CanonicalUnitRecord[] = [];
      const docSnap = await (firestore.collection("units") as any).doc(reference).get().catch(() => null);
      if (docSnap?.exists) {
        rows.push(toCanonicalUnitRecord(docSnap.id || reference, (docSnap.data() || {}) as Record<string, unknown>));
      }
      const fieldSnap = await (firestore.collection("units") as any).where("unitId", "==", reference).get().catch(() => null);
      for (const doc of fieldSnap?.docs || []) {
        rows.push(toCanonicalUnitRecord(doc.id, (doc.data() || {}) as Record<string, unknown>));
      }
      if (rows.length) out.set(reference, rows);
    })
  );
  return out;
}

function tenantRelationshipKeys(tenant: TenantDocRow): string[] {
  return Array.from(
    new Set(
      [
        tenant.id,
        tenant.raw.id,
        tenant.raw.tenantId,
        tenant.raw.userId,
        tenant.raw.uid,
        tenant.raw.accountId,
        tenant.raw.profileId,
        tenant.raw.authUid,
      ]
        .map((value) => asTrimmedString(value))
        .filter(Boolean)
    )
  );
}

async function loadReverseLeaseLinks(
  firestore: FirestoreLike,
  tenants: TenantDocRow[]
): Promise<Map<string, LeaseDocRow[]>> {
  const out = new Map<string, LeaseDocRow[]>();
  const keyToTenantIds = new Map<string, string[]>();
  for (const tenant of tenants) {
    for (const key of tenantRelationshipKeys(tenant)) {
      const existing = keyToTenantIds.get(key) || [];
      existing.push(tenant.id);
      keyToTenantIds.set(key, existing);
    }
  }
  const uniqueTenantIds = Array.from(keyToTenantIds.keys());
  await Promise.all(
    uniqueTenantIds.map(async (tenantId) => {
      const rows = new Map<string, LeaseDocRow>();
      const directSnap = await (firestore.collection("leases") as any).where("tenantId", "==", tenantId).get().catch(() => null);
      for (const doc of directSnap?.docs || []) {
        rows.set(doc.id, { id: doc.id, raw: (doc.data() || {}) as Record<string, unknown> });
      }
      const arraySnap = await (firestore.collection("leases") as any)
        .where("tenantIds", "array-contains", tenantId)
        .get()
        .catch(() => null);
      for (const doc of arraySnap?.docs || []) {
        rows.set(doc.id, { id: doc.id, raw: (doc.data() || {}) as Record<string, unknown> });
      }
      if (rows.size) {
        for (const ownerTenantId of keyToTenantIds.get(tenantId) || []) {
          const existing = new Map((out.get(ownerTenantId) || []).map((row) => [row.id, row]));
          for (const row of rows.values()) existing.set(row.id, row);
          out.set(ownerTenantId, Array.from(existing.values()));
        }
      }
    })
  );
  return out;
}

function resolveLeaseLink(
  tenant: TenantDocRow,
  leasesById: Map<string, Record<string, unknown>>,
  reverseLeasesByTenantId: Map<string, LeaseDocRow[]> = new Map()
): LeaseLink {
  const leaseId = asTrimmedString(tenant.raw.currentLeaseId || tenant.raw.leaseId);
  const explicitRaw = leaseId ? leasesById.get(leaseId) : null;
  const candidates: LeaseDocRow[] = explicitRaw
    ? [{ id: leaseId, raw: explicitRaw }]
    : reverseLeasesByTenantId.get(tenant.id) || [];
  const compatible = candidates.filter(({ raw }) => {
    if (!explicitRaw && !isCurrentLeaseStatus(leaseStatus(raw))) return false;

    const tenantLandlordId = asTrimmedString(tenant.raw.landlordId);
    const leaseLandlordId = asTrimmedString(raw.landlordId);
    if (tenantLandlordId && leaseLandlordId && tenantLandlordId !== leaseLandlordId) return false;

    const tenantPropertyId = asTrimmedString(tenant.raw.propertyId);
    const leasePropertyId = asTrimmedString(raw.propertyId);
    if (tenantPropertyId && leasePropertyId && tenantPropertyId !== leasePropertyId) return false;

    const tenantUnitId = asTrimmedString(tenant.raw.unitId);
    const leaseUnitId = asTrimmedString(raw.unitId);
    if (tenantUnitId && leaseUnitId && tenantUnitId !== leaseUnitId) return false;

    return true;
  });
  compatible.sort((a, b) => (leaseStart(b.raw) || "").localeCompare(leaseStart(a.raw) || ""));
  const winner = compatible[0];
  return winner ? { id: winner.id, raw: winner.raw } : null;
}

function buildView(
  tenant: TenantDocRow,
  leasesById: Map<string, Record<string, unknown>>,
  reverseLeasesByTenantId: Map<string, LeaseDocRow[]>,
  propertiesById: Map<string, Record<string, unknown>>,
  unitsByPropertyScope: Map<string, CanonicalUnitRecord[]>,
  unitsById: Map<string, Record<string, unknown>>,
  unitsByReference: Map<string, CanonicalUnitRecord[]>
): AdminTenantView {
  const names = nameParts(tenant.raw);
  const linkedLease = resolveLeaseLink(tenant, leasesById, reverseLeasesByTenantId);

  const propertyId =
    asTrimmedString(tenant.raw.propertyId) ||
    asTrimmedString(linkedLease?.raw.propertyId) ||
    null;
  const property = propertyId ? propertiesById.get(propertyId) : null;
  const landlordId = asTrimmedString(tenant.raw.landlordId) || asTrimmedString(linkedLease?.raw.landlordId) || null;
  const propertyName =
    asTrimmedString(property?.name) ||
    asTrimmedString(tenant.raw.propertyName || tenant.raw.property) ||
    asTrimmedString(linkedLease?.raw.propertyName) ||
    asTrimmedString(linkedLease?.raw.propertyLabel) ||
    null;
  const unitId =
    asTrimmedString(tenant.raw.unitId) ||
    asTrimmedString(linkedLease?.raw.unitId) ||
    asTrimmedString(linkedLease?.raw.resolvedUnitId) ||
    asTrimmedString(tenant.raw.unitNumber) ||
    asTrimmedString(linkedLease?.raw.unitNumber) ||
    null;
  const propertyUnits = propertyId
    ? mergeUnits(
        unitsByPropertyScope.get(unitScopeKey(propertyId, landlordId)) || [],
        unitsByPropertyScope.get(unitScopeKey(propertyId, null)) || []
      )
    : [];
  const directUnitRaw = unitId ? unitsById.get(unitId) : null;
  const unitCandidates = [...propertyUnits];
  const unitReferences = [
    tenant.raw.unitId,
    tenant.raw.resolvedUnitId,
    tenant.raw.unitNumber,
    tenant.raw.unitLabel,
    tenant.raw.unit,
    linkedLease?.raw.unitId,
    linkedLease?.raw.resolvedUnitId,
    linkedLease?.raw.unitNumber,
    linkedLease?.raw.unitLabel,
    linkedLease?.raw.unit,
  ]
    .map((value) => asTrimmedString(value))
    .filter(Boolean);
  for (const reference of unitReferences) {
    for (const unit of unitsByReference.get(reference) || []) {
      if (!unitCandidates.some((existing) => existing.id === unit.id)) unitCandidates.push(unit);
    }
  }
  if (directUnitRaw && !unitCandidates.some((unit) => unit.id === unitId)) {
    unitCandidates.push({
      id: unitId!,
      landlordId: asTrimmedString(directUnitRaw.landlordId) || null,
      propertyId: asTrimmedString(directUnitRaw.propertyId) || propertyId,
      unitNumber: asTrimmedString(directUnitRaw.unitNumber ?? directUnitRaw.unit ?? directUnitRaw.name) || null,
      label: asTrimmedString(directUnitRaw.label ?? directUnitRaw.displayLabel ?? directUnitRaw.unitLabel ?? directUnitRaw.unitNumber) || null,
      rent: Number.isFinite(Number(directUnitRaw.rent ?? directUnitRaw.marketRent ?? directUnitRaw.monthlyRent))
        ? Number(directUnitRaw.rent ?? directUnitRaw.marketRent ?? directUnitRaw.monthlyRent)
        : null,
      raw: directUnitRaw,
    });
  }
  const canonicalLease = linkedLease ? toCanonicalLeaseRecord(linkedLease.id, linkedLease.raw, unitCandidates) : null;
  const resolvedLeaseUnit =
    canonicalUnitLabel(unitCandidates.find((unit) => unit.id === canonicalLease?.resolvedUnitId)) ||
    normalizeUnitDisplayValue(canonicalLease?.resolvedUnitLabel) ||
    normalizeUnitDisplayValue(canonicalLease?.resolvedUnitNumber) ||
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
    landlordId,
    propertyId,
    propertyName,
    unitId,
    unitNumber: sanitizeUnitNumber(
      canonicalUnitLabel(directUnitRaw ? toCanonicalUnitRecord(unitId!, directUnitRaw) : null) ||
        safeUnitLabel(tenant.raw, unitCandidates) ||
        resolvedLeaseUnit ||
        safeUnitLabel((linkedLease?.raw || {}) as Record<string, unknown>, unitCandidates) ||
        null,
      unitId
    ),
    leaseId,
    leaseStatus: currentLeaseStatus,
    screeningStatus: currentScreeningStatus,
    moveInStatus: currentMoveInStatus,
    currentLeaseStartDate:
      leaseStart((linkedLease?.raw || {}) as Record<string, unknown>) ||
      normalizeDate(tenant.raw.leaseStart),
    currentLeaseEndDate:
      leaseEnd((linkedLease?.raw || {}) as Record<string, unknown>) ||
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
  const [leasesById, reverseLeasesByTenantId] = await Promise.all([
    loadLinkedDocs(firestore, "leases", leaseIds),
    loadReverseLeaseLinks(firestore, tenantDocs),
  ]);

  const propertyIds = Array.from(
    new Set(
      tenantDocs
        .map((tenant) => {
          const linkedLease = resolveLeaseLink(tenant, leasesById, reverseLeasesByTenantId);
          return asTrimmedString(tenant.raw.propertyId || linkedLease?.raw.propertyId);
        })
        .filter(Boolean)
    )
  );
  const propertiesById = await loadLinkedDocs(firestore, "properties", propertyIds);
  const unitIds = Array.from(
    new Set(
      tenantDocs
        .flatMap((tenant) => {
          const linkedLease = resolveLeaseLink(tenant, leasesById, reverseLeasesByTenantId);
          return [
            tenant.raw.unitId,
            tenant.raw.resolvedUnitId,
            tenant.raw.unitNumber,
            tenant.raw.unitLabel,
            tenant.raw.unit,
            linkedLease?.raw.unitId,
            linkedLease?.raw.resolvedUnitId,
            linkedLease?.raw.unitNumber,
            linkedLease?.raw.unitLabel,
            linkedLease?.raw.unit,
          ];
        })
        .map((value) => asTrimmedString(value))
        .filter(Boolean)
    )
  );
  const unitsById = await loadLinkedDocs(firestore, "units", unitIds);
  const unitsByReference = await loadUnitsByReferences(firestore, unitIds);
  const scopedUnitEntries = tenantDocs
    .map((tenant) => {
      const linkedLease = resolveLeaseLink(tenant, leasesById, reverseLeasesByTenantId);
      const propertyId = asTrimmedString(tenant.raw.propertyId || linkedLease?.raw.propertyId);
      if (!propertyId) return null;
      const landlordId = asTrimmedString(tenant.raw.landlordId || linkedLease?.raw.landlordId);
      return [unitScopeKey(propertyId, landlordId), { propertyId, landlordId }] as const;
    })
    .filter((value): value is readonly [string, { propertyId: string; landlordId: string }] => Boolean(value));
  const unscopedUnitEntries = propertyIds.map((propertyId) => [unitScopeKey(propertyId, null), { propertyId, landlordId: "" }] as const);
  const unitScopes = Array.from(
    new Map(
      [...scopedUnitEntries, ...unscopedUnitEntries]
    ).values()
  );
  const unitsByPropertyScope = new Map<string, CanonicalUnitRecord[]>();
  await Promise.all(
    unitScopes.map(async ({ propertyId, landlordId }) => {
      unitsByPropertyScope.set(
        unitScopeKey(propertyId, landlordId),
        await loadUnitsForProperty(firestore as any, propertyId, landlordId).catch(() => [])
      );
    })
  );

  const allViews = tenantDocs.map((tenant) =>
    buildView(tenant, leasesById, reverseLeasesByTenantId, propertiesById, unitsByPropertyScope, unitsById, unitsByReference)
  );

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
