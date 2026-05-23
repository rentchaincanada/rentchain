import { db } from "../../config/firebase";

type FirestoreLike = Pick<FirebaseFirestore.Firestore, "collection">;

export type AdminPropertyView = {
  id: string;
  displayLabel: string;
  name: string | null;
  address1: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  pid: string | null;
  ownerUserId: string | null;
  landlordId: string | null;
  ownerDisplayName: string | null;
  ownerStatusLabel: string;
  managerUserIds: string[];
  unitCount: number;
  occupiedUnitCount: number;
  vacantUnitCount: number;
  createdAt: string | number | null;
  updatedAt: string | number | null;
  integrity: {
    hasIssues: boolean;
    orphaned: boolean;
    missingOwner: boolean;
  };
};

export type AdminPropertiesQuery = {
  q?: string | null;
  province?: string | null;
  landlordId?: string | null;
  ownerUserId?: string | null;
  integrity?: "all" | "issues" | "orphaned" | "missingOwner" | null;
  sortBy?: "createdAt" | "updatedAt" | "name" | null;
  sortDir?: "asc" | "desc" | null;
  page?: number | null;
  pageSize?: number | null;
};

export type AdminPropertiesResult = {
  items: AdminPropertyView[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
};

function asTrimmedString(value: unknown): string {
  return String(value || "").trim();
}

function normalizeQuery(input?: AdminPropertiesQuery) {
  const pageRaw = Number(input?.page ?? 1);
  const pageSizeRaw = Number(input?.pageSize ?? 25);
  return {
    q: asTrimmedString(input?.q).toLowerCase() || null,
    province: asTrimmedString(input?.province).toUpperCase() || null,
    landlordId: asTrimmedString(input?.landlordId) || null,
    ownerUserId: asTrimmedString(input?.ownerUserId) || null,
    integrity:
      input?.integrity === "issues" || input?.integrity === "orphaned" || input?.integrity === "missingOwner"
        ? input.integrity
        : "all",
    sortBy: input?.sortBy === "createdAt" || input?.sortBy === "name" ? input.sortBy : "updatedAt",
    sortDir: input?.sortDir === "asc" ? "asc" : "desc",
    page: Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1,
    pageSize:
      Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? Math.min(Math.floor(pageSizeRaw), 100) : 25,
  } as const;
}

function safeArray(values: unknown): string[] {
  return Array.isArray(values) ? values.map((value) => asTrimmedString(value)).filter(Boolean) : [];
}

function computeIntegrity(raw: Record<string, unknown>) {
  const ownerUserId = asTrimmedString(raw.ownerUserId) || null;
  const landlordId = asTrimmedString(raw.landlordId) || null;
  const managerUserIds = safeArray(raw.managerUserIds);
  const missingOwner = !ownerUserId;
  const orphaned = !ownerUserId && !landlordId && managerUserIds.length === 0;
  return {
    hasIssues: missingOwner || orphaned,
    orphaned,
    missingOwner,
  };
}

function safeAccountDisplayName(record: Record<string, unknown> | null | undefined): string | null {
  return (
    asTrimmedString(record?.businessName) ||
    asTrimmedString(record?.companyName) ||
    asTrimmedString(record?.displayName) ||
    asTrimmedString(record?.name) ||
    null
  );
}

function ownerStatusLabel(input: { ownerUserId: string | null; landlordId: string | null; managerUserIds: string[] }) {
  if (input.ownerUserId) return "Owner profile linked";
  if (input.landlordId) return "Landlord linked / owner profile missing";
  if (input.managerUserIds.length) return "Manager linked / owner profile missing";
  return "No owner or landlord link";
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

function matchesSearch(raw: Record<string, unknown>, propertyId: string, q: string | null, ownerDisplayName?: string | null) {
  if (!q) return true;
  const haystack = [
    propertyId,
    raw.name,
    raw.addressLine1,
    raw.address1,
    raw.city,
    ownerDisplayName,
    raw.pid,
    raw.propertyPid,
    raw.parcelId,
    raw.parcelPid,
  ]
    .map((value) => asTrimmedString(value).toLowerCase())
    .filter(Boolean)
    .join(" ");
  return haystack.includes(q);
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

async function loadUnitCounts(
  firestore: FirestoreLike,
  propertyIds: string[]
): Promise<Map<string, { unitCount: number; occupiedUnitCount: number; vacantUnitCount: number }>> {
  const results = new Map<string, { unitCount: number; occupiedUnitCount: number; vacantUnitCount: number }>();
  await Promise.all(
    propertyIds.map(async (propertyId) => {
      const snap = await firestore.collection("units").where("propertyId", "==", propertyId).get();
      const docs = snap.docs || [];
      let occupiedUnitCount = 0;
      let vacantUnitCount = 0;
      docs.forEach((doc: any) => {
        const raw = (doc.data() || {}) as Record<string, unknown>;
        const status = asTrimmedString(raw.occupancyStatus || raw.status).toLowerCase();
        if (status === "occupied") occupiedUnitCount += 1;
        if (status === "vacant") vacantUnitCount += 1;
      });
      results.set(propertyId, {
        unitCount: docs.length,
        occupiedUnitCount,
        vacantUnitCount,
      });
    })
  );
  return results;
}

export async function listAdminProperties(
  input?: AdminPropertiesQuery & { firestore?: FirestoreLike }
): Promise<AdminPropertiesResult> {
  const firestore = (input?.firestore || (db as any)) as FirestoreLike;
  const query = normalizeQuery(input);
  let collectionQuery: FirebaseFirestore.Query = firestore.collection("properties");

  if (query.landlordId) {
    collectionQuery = collectionQuery.where("landlordId", "==", query.landlordId);
  }
  if (query.ownerUserId) {
    collectionQuery = collectionQuery.where("ownerUserId", "==", query.ownerUserId);
  }

  const snap = await collectionQuery.get();
  const allDocs = (snap.docs || []).map((doc: any) => ({ id: doc.id, raw: (doc.data() || {}) as Record<string, unknown> }));
  const landlordIds = Array.from(new Set(allDocs.map(({ raw }) => asTrimmedString(raw.landlordId)).filter(Boolean)));
  const ownerUserIds = Array.from(new Set(allDocs.map(({ raw }) => asTrimmedString(raw.ownerUserId)).filter(Boolean)));
  const [landlordsById, usersById] = await Promise.all([
    loadLinkedDocs(firestore, "landlords", landlordIds),
    loadLinkedDocs(firestore, "users", ownerUserIds),
  ]);

  const filtered = allDocs.filter(({ id, raw }) => {
    if (query.province && asTrimmedString(raw.province).toUpperCase() !== query.province) return false;
    const integrity = computeIntegrity(raw);
    if (query.integrity === "issues" && !integrity.hasIssues) return false;
    if (query.integrity === "orphaned" && !integrity.orphaned) return false;
    if (query.integrity === "missingOwner" && !integrity.missingOwner) return false;
    const landlordId = asTrimmedString(raw.landlordId) || null;
    const ownerUserId = asTrimmedString(raw.ownerUserId) || null;
    const ownerDisplayName =
      safeAccountDisplayName(ownerUserId ? usersById.get(ownerUserId) : null) ||
      safeAccountDisplayName(landlordId ? landlordsById.get(landlordId) : null);
    return matchesSearch(raw, id, query.q, ownerDisplayName);
  });

  filtered.sort((a, b) => {
    const aValue =
      query.sortBy === "name"
        ? asTrimmedString(a.raw.name) || null
        : (a.raw[query.sortBy] as string | number | null | undefined) ?? null;
    const bValue =
      query.sortBy === "name"
        ? asTrimmedString(b.raw.name) || null
        : (b.raw[query.sortBy] as string | number | null | undefined) ?? null;
    return compareValues(aValue, bValue, query.sortDir);
  });

  const total = filtered.length;
  const startIndex = (query.page - 1) * query.pageSize;
  const paged = filtered.slice(startIndex, startIndex + query.pageSize);
  const countsByProperty = await loadUnitCounts(
    firestore,
    paged.map((entry) => entry.id)
  );

  const items: AdminPropertyView[] = paged.map(({ id, raw }) => {
    const counts = countsByProperty.get(id);
    const integrity = computeIntegrity(raw);
    const fallbackUnitCount = Number(raw.unitCount || raw.totalUnits || 0) || 0;
    const ownerUserId = asTrimmedString(raw.ownerUserId) || null;
    const landlordId = asTrimmedString(raw.landlordId) || null;
    const managerUserIds = safeArray(raw.managerUserIds);
    const ownerDisplayName =
      safeAccountDisplayName(ownerUserId ? usersById.get(ownerUserId) : null) ||
      safeAccountDisplayName(landlordId ? landlordsById.get(landlordId) : null) ||
      null;
    const name = asTrimmedString(raw.name) || null;
    return {
      id,
      displayLabel: name || "Property not labelled",
      name,
      address1: asTrimmedString(raw.addressLine1 || raw.address1) || null,
      city: asTrimmedString(raw.city) || null,
      province: asTrimmedString(raw.province) || null,
      postalCode: asTrimmedString(raw.postalCode) || null,
      pid:
        asTrimmedString(raw.pid) ||
        asTrimmedString((raw as any).PID) ||
        asTrimmedString(raw.propertyPid) ||
        asTrimmedString(raw.parcelId) ||
        asTrimmedString(raw.parcelPid) ||
        asTrimmedString((raw.metadata as any)?.pid) ||
        asTrimmedString((raw.metadata as any)?.propertyPid) ||
        asTrimmedString((raw.metadata as any)?.parcelId) ||
        null,
      ownerUserId,
      landlordId,
      ownerDisplayName,
      ownerStatusLabel: ownerStatusLabel({ ownerUserId, landlordId, managerUserIds }),
      managerUserIds,
      unitCount: counts?.unitCount ?? fallbackUnitCount,
      occupiedUnitCount: counts?.occupiedUnitCount ?? 0,
      vacantUnitCount: counts?.vacantUnitCount ?? 0,
      createdAt: (raw.createdAt as string | number | null | undefined) ?? null,
      updatedAt: (raw.updatedAt as string | number | null | undefined) ?? null,
      integrity,
    };
  });

  return {
    items,
    page: query.page,
    pageSize: query.pageSize,
    total,
    hasMore: startIndex + query.pageSize < total,
  };
}
