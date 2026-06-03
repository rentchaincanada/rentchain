import { db } from "../../firebase";

type FirestoreLike = Pick<FirebaseFirestore.Firestore, "collection">;

export type AdminSavedFilterPageKey = "properties" | "tenants" | "leases" | "integrity";

export type AdminSavedFilterPreset = {
  id: string;
  userId: string;
  pageKey: AdminSavedFilterPageKey;
  name: string;
  filters: Record<string, string | number | boolean | null>;
  createdAt: string | number;
  updatedAt: string | number;
};

type ListSavedFiltersInput = {
  userId: string;
  pageKey: AdminSavedFilterPageKey;
  firestore?: FirestoreLike;
};

type CreateSavedFilterInput = {
  userId: string;
  pageKey: AdminSavedFilterPageKey;
  name: string;
  filters: Record<string, unknown>;
  firestore?: FirestoreLike;
};

type DeleteSavedFilterInput = {
  userId: string;
  id: string;
  firestore?: FirestoreLike;
};

const ALLOWED_PAGE_KEYS: AdminSavedFilterPageKey[] = ["properties", "tenants", "leases", "integrity"];

const ALLOWED_FILTER_KEYS: Record<AdminSavedFilterPageKey, string[]> = {
  properties: ["q", "province", "landlordId", "ownerUserId", "integrity", "sortBy", "sortDir"],
  tenants: ["q", "landlordId", "propertyId", "leaseStatus", "screeningStatus", "moveInStatus", "sortBy", "sortDir"],
  leases: [
    "q",
    "landlordId",
    "propertyId",
    "status",
    "riskGrade",
    "integrity",
    "startAfter",
    "startBefore",
    "endAfter",
    "endBefore",
    "sortBy",
    "sortDir",
  ],
  integrity: [],
};

function asTrimmedString(value: unknown) {
  return String(value || "").trim();
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeTimestamp(value: unknown): string | number {
  if (typeof value === "number") return value;
  const next = asTrimmedString(value);
  return next || Date.now();
}

export function isAdminSavedFilterPageKey(value: unknown): value is AdminSavedFilterPageKey {
  return ALLOWED_PAGE_KEYS.includes(value as AdminSavedFilterPageKey);
}

export function sanitizeSavedFilterPayload(
  pageKey: AdminSavedFilterPageKey,
  filters: Record<string, unknown>
): Record<string, string | number | boolean | null> {
  if (!isPlainObject(filters)) {
    throw new Error("filters must be a plain object");
  }
  const allowedKeys = new Set(ALLOWED_FILTER_KEYS[pageKey]);
  const entries = Object.entries(filters);
  if (entries.length > 20) {
    throw new Error("too many filter keys");
  }

  const sanitized: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of entries) {
    if (!allowedKeys.has(key)) continue;
    if (value == null) {
      sanitized[key] = null;
      continue;
    }
    if (typeof value === "string") {
      const next = value.trim();
      if (next.length > 200) throw new Error(`filter ${key} is too long`);
      sanitized[key] = next;
      continue;
    }
    if (typeof value === "number") {
      if (!Number.isFinite(value)) throw new Error(`filter ${key} must be finite`);
      sanitized[key] = value;
      continue;
    }
    if (typeof value === "boolean") {
      sanitized[key] = value;
      continue;
    }
    throw new Error(`filter ${key} has unsupported value type`);
  }
  return sanitized;
}

function toPreset(id: string, raw: Record<string, unknown>): AdminSavedFilterPreset {
  return {
    id,
    userId: asTrimmedString(raw.userId),
    pageKey: raw.pageKey as AdminSavedFilterPageKey,
    name: asTrimmedString(raw.name),
    filters: isPlainObject(raw.filters) ? (raw.filters as Record<string, string | number | boolean | null>) : {},
    createdAt: normalizeTimestamp(raw.createdAt),
    updatedAt: normalizeTimestamp(raw.updatedAt),
  };
}

export async function listAdminSavedFilters(input: ListSavedFiltersInput): Promise<AdminSavedFilterPreset[]> {
  const firestore = (input.firestore || (db as any)) as FirestoreLike;
  const userId = asTrimmedString(input.userId);
  if (!userId) throw new Error("userId is required");
  if (!isAdminSavedFilterPageKey(input.pageKey)) throw new Error("invalid pageKey");

  const snap = await firestore.collection("adminSavedFilters").where("userId", "==", userId).get();
  const docs = (snap.docs || [])
    .map((doc: any) => toPreset(doc.id, (doc.data() || {}) as Record<string, unknown>))
    .filter((preset) => preset.pageKey === input.pageKey)
    .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
  return docs;
}

export async function createAdminSavedFilter(input: CreateSavedFilterInput): Promise<AdminSavedFilterPreset> {
  const firestore = (input.firestore || (db as any)) as FirestoreLike;
  const userId = asTrimmedString(input.userId);
  const name = asTrimmedString(input.name);
  if (!userId) throw new Error("userId is required");
  if (!isAdminSavedFilterPageKey(input.pageKey)) throw new Error("invalid pageKey");
  if (!name) throw new Error("name is required");
  if (name.length > 80) throw new Error("name is too long");

  const filters = sanitizeSavedFilterPayload(input.pageKey, input.filters || {});
  const now = Date.now();
  const ref = (firestore.collection("adminSavedFilters") as any).doc();
  const record = {
    userId,
    pageKey: input.pageKey,
    name,
    filters,
    createdAt: now,
    updatedAt: now,
  };
  await ref.set(record);
  return toPreset(ref.id, record);
}

export async function deleteAdminSavedFilter(input: DeleteSavedFilterInput): Promise<void> {
  const firestore = (input.firestore || (db as any)) as FirestoreLike;
  const userId = asTrimmedString(input.userId);
  const id = asTrimmedString(input.id);
  if (!userId) throw new Error("userId is required");
  if (!id) throw new Error("id is required");

  const ref = (firestore.collection("adminSavedFilters") as any).doc(id);
  const snap = await ref.get();
  if (!snap?.exists) return;
  const raw = (snap.data() || {}) as Record<string, unknown>;
  if (asTrimmedString(raw.userId) !== userId) {
    throw new Error("preset not found");
  }
  await ref.delete();
}
