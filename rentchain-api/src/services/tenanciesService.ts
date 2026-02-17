import { db, FieldValue } from "../config/firebase";

export type TenancyStatus = "active" | "inactive";
export type MoveOutReason =
  | "LEASE_TERM_END"
  | "EARLY_LEASE_END"
  | "EVICTED"
  | "OTHER";

export interface TenancyRecord {
  id: string;
  tenantId: string;
  landlordId?: string | null;
  propertyId?: string | null;
  unitId?: string | null;
  unitLabel?: string | null;
  status: TenancyStatus;
  moveInAt?: string | null;
  moveOutAt?: string | null;
  moveOutReason?: MoveOutReason | null;
  moveOutReasonNote?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

type ListTenantTenanciesOpts = {
  landlordId?: string | null;
  isAdmin?: boolean;
};

type UpdateTenancyPatch = {
  moveInAt?: string | null;
  moveOutAt?: string | null;
  moveOutReason?: MoveOutReason | null;
  moveOutReasonNote?: string | null;
  status?: TenancyStatus;
};

function toIso(value: any): string | null {
  if (!value) return null;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
  }
  if (typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  if (typeof value?.toDate === "function") {
    const parsed = value.toDate();
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  return null;
}

function toMillis(value: any): number {
  const iso = toIso(value);
  if (!iso) return 0;
  return Date.parse(iso) || 0;
}

function mapTenancy(docId: string, data: any): TenancyRecord {
  return {
    id: docId,
    tenantId: String(data?.tenantId || "").trim(),
    landlordId: data?.landlordId ?? null,
    propertyId: data?.propertyId ?? null,
    unitId: data?.unitId ?? null,
    unitLabel: data?.unitLabel ?? null,
    status: data?.status === "inactive" ? "inactive" : "active",
    moveInAt: toIso(data?.moveInAt),
    moveOutAt: toIso(data?.moveOutAt),
    moveOutReason: data?.moveOutReason ?? null,
    moveOutReasonNote: data?.moveOutReasonNote ?? null,
    createdAt: toIso(data?.createdAt),
    updatedAt: toIso(data?.updatedAt),
  };
}

function deriveStatus(
  moveInAt: string | null,
  moveOutAt: string | null,
  explicitStatus?: TenancyStatus
): TenancyStatus {
  if (moveOutAt) return "inactive";
  if (moveInAt) return "active";
  return explicitStatus === "inactive" ? "inactive" : "active";
}

function normalizePatch(patch: UpdateTenancyPatch): UpdateTenancyPatch {
  const out: UpdateTenancyPatch = {};
  if (Object.prototype.hasOwnProperty.call(patch, "moveInAt")) {
    out.moveInAt = patch.moveInAt ? toIso(patch.moveInAt) : null;
  }
  if (Object.prototype.hasOwnProperty.call(patch, "moveOutAt")) {
    out.moveOutAt = patch.moveOutAt ? toIso(patch.moveOutAt) : null;
  }
  if (Object.prototype.hasOwnProperty.call(patch, "moveOutReason")) {
    out.moveOutReason = patch.moveOutReason ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(patch, "moveOutReasonNote")) {
    const note = patch.moveOutReasonNote;
    out.moveOutReasonNote = typeof note === "string" ? note.trim() || null : null;
  }
  if (Object.prototype.hasOwnProperty.call(patch, "status")) {
    out.status = patch.status === "inactive" ? "inactive" : "active";
  }
  return out;
}

export function buildDerivedTenancyFromTenant(tenant: any): TenancyRecord | null {
  const tenantId = String(tenant?.id || "").trim();
  if (!tenantId) return null;
  const propertyId = tenant?.propertyId ? String(tenant.propertyId) : null;
  const unitId = tenant?.unitId ? String(tenant.unitId) : null;
  const unitLabel = tenant?.unit ? String(tenant.unit) : null;
  if (!propertyId && !unitId && !unitLabel) return null;

  const moveInAt = toIso(tenant?.leaseStart) || toIso(tenant?.createdAt);
  const moveOutAt = toIso(tenant?.leaseEnd);
  return {
    id: `derived-${tenantId}`,
    tenantId,
    landlordId: tenant?.landlordId ?? null,
    propertyId,
    unitId: unitId || unitLabel || null,
    unitLabel: unitLabel || unitId || null,
    status: deriveStatus(moveInAt, moveOutAt),
    moveInAt,
    moveOutAt,
    moveOutReason: null,
    moveOutReasonNote: null,
    createdAt: toIso(tenant?.createdAt),
    updatedAt: toIso(tenant?.createdAt),
  };
}

export async function getTenancyById(tenancyId: string): Promise<TenancyRecord | null> {
  const id = String(tenancyId || "").trim();
  if (!id) return null;
  const snap = await db.collection("tenancies").doc(id).get();
  if (!snap.exists) return null;
  return mapTenancy(snap.id, snap.data() as any);
}

export async function listTenanciesByTenantId(
  tenantId: string,
  opts: ListTenantTenanciesOpts = {}
): Promise<TenancyRecord[]> {
  const id = String(tenantId || "").trim();
  if (!id) return [];
  const landlordId = opts.landlordId?.trim?.() ? String(opts.landlordId).trim() : null;
  const isAdmin = opts.isAdmin === true;

  const snap = await db.collection("tenancies").where("tenantId", "==", id).get();
  const out = snap.docs.map((doc) => mapTenancy(doc.id, doc.data() as any));
  const filtered = isAdmin
    ? out
    : out.filter((t) => !landlordId || String(t.landlordId || "") === landlordId);
  filtered.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
  return filtered;
}

export async function updateTenancyLifecycle(
  tenancyId: string,
  patch: UpdateTenancyPatch
): Promise<TenancyRecord> {
  const existing = await getTenancyById(tenancyId);
  if (!existing) {
    throw new Error("TENANCY_NOT_FOUND");
  }

  const normalized = normalizePatch(patch);
  const moveInAt = Object.prototype.hasOwnProperty.call(normalized, "moveInAt")
    ? normalized.moveInAt ?? null
    : existing.moveInAt ?? null;
  const moveOutAt = Object.prototype.hasOwnProperty.call(normalized, "moveOutAt")
    ? normalized.moveOutAt ?? null
    : existing.moveOutAt ?? null;
  const moveOutReason = Object.prototype.hasOwnProperty.call(normalized, "moveOutReason")
    ? normalized.moveOutReason ?? null
    : existing.moveOutReason ?? null;
  const moveOutReasonNote = Object.prototype.hasOwnProperty.call(normalized, "moveOutReasonNote")
    ? normalized.moveOutReasonNote ?? null
    : existing.moveOutReasonNote ?? null;

  if (moveOutAt && !moveOutReason) {
    throw new Error("MOVE_OUT_REASON_REQUIRED");
  }
  if (moveOutAt && moveOutReason === "OTHER" && !moveOutReasonNote) {
    throw new Error("MOVE_OUT_REASON_NOTE_REQUIRED");
  }

  const status = deriveStatus(moveInAt, moveOutAt, normalized.status ?? existing.status);
  const updateDoc: Record<string, any> = {
    status,
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (Object.prototype.hasOwnProperty.call(normalized, "moveInAt")) {
    updateDoc.moveInAt = moveInAt;
  }
  if (Object.prototype.hasOwnProperty.call(normalized, "moveOutAt")) {
    updateDoc.moveOutAt = moveOutAt;
  }
  if (Object.prototype.hasOwnProperty.call(normalized, "moveOutReason")) {
    updateDoc.moveOutReason = moveOutReason;
  }
  if (Object.prototype.hasOwnProperty.call(normalized, "moveOutReasonNote")) {
    updateDoc.moveOutReasonNote = moveOutReasonNote;
  }
  if (Object.prototype.hasOwnProperty.call(normalized, "status")) {
    updateDoc.status = status;
  }

  await db.collection("tenancies").doc(existing.id).set(updateDoc, { merge: true });
  const updated = await getTenancyById(existing.id);
  if (!updated) throw new Error("TENANCY_NOT_FOUND");
  return updated;
}

export async function createTenancyIfMissing(input: {
  tenantId: string;
  landlordId: string;
  propertyId?: string | null;
  unitId?: string | null;
  unitLabel?: string | null;
  moveInAt?: string | null;
}): Promise<TenancyRecord | null> {
  const tenantId = String(input.tenantId || "").trim();
  const landlordId = String(input.landlordId || "").trim();
  if (!tenantId || !landlordId) return null;

  const propertyId = input.propertyId ? String(input.propertyId).trim() : null;
  const unitId = input.unitId ? String(input.unitId).trim() : null;
  const unitLabel = input.unitLabel ? String(input.unitLabel).trim() : null;
  if (!propertyId && !unitId && !unitLabel) return null;

  const existing = await listTenanciesByTenantId(tenantId, { landlordId, isAdmin: false });
  const duplicate = existing.find((row) => {
    const sameProperty = String(row.propertyId || "") === String(propertyId || "");
    const sameUnit =
      String(row.unitId || "") === String(unitId || "") ||
      String(row.unitLabel || "") === String(unitLabel || "");
    return sameProperty && sameUnit && row.status === "active";
  });
  if (duplicate) return duplicate;

  const now = new Date();
  const ref = db.collection("tenancies").doc();
  const payload = {
    tenantId,
    landlordId,
    propertyId: propertyId || null,
    unitId: unitId || unitLabel || null,
    unitLabel: unitLabel || unitId || null,
    status: "active" as TenancyStatus,
    moveInAt: toIso(input.moveInAt) || now.toISOString(),
    moveOutAt: null,
    moveOutReason: null,
    moveOutReasonNote: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  await ref.set(payload);
  const created = await getTenancyById(ref.id);
  return created;
}
