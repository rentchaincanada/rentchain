import { db } from "../config/firebase";
import { computeLedgerEventHashV1 } from "../utils/ledgerHash";

export type LedgerEventV2Type =
  | "PROPERTY_CREATED"
  | "UNIT_CREATED"
  | "TENANT_CREATED"
  | "LEASE_CREATED"
  | "PAYMENT_RECORDED"
  | "PAYMENT_UPDATED"
  | "NOTE_ADDED"
  | "STATUS_CHANGED";

export interface LedgerEventV2 {
  id: string;
  landlordId: string;
  propertyId?: string;
  unitId?: string;
  tenantId?: string;
  leaseId?: string;
  paymentId?: string;
  eventType: LedgerEventV2Type;
  title: string;
  summary?: string;
  amount?: number;
  currency?: "CAD" | "USD";
  occurredAt: number;
  createdAt: number;
  actor: {
    type: "LANDLORD" | "SYSTEM";
    userId?: string;
    email?: string;
  };
  tags?: string[];
  metadata?: Record<string, any>;
  prevHash?: string | null;
  hash?: string;
  hashVersion?: number;
}

const COLLECTION = "ledgerEventsV2";
const ALLOWED_EVENT_TYPES: LedgerEventV2Type[] = [
  "PROPERTY_CREATED",
  "UNIT_CREATED",
  "TENANT_CREATED",
  "LEASE_CREATED",
  "PAYMENT_RECORDED",
  "PAYMENT_UPDATED",
  "NOTE_ADDED",
  "STATUS_CHANGED",
];

export async function emitLedgerEventV2(
  input: Partial<LedgerEventV2> &
    Required<Pick<LedgerEventV2, "landlordId" | "eventType" | "title">>
): Promise<LedgerEventV2> {
  if (!ALLOWED_EVENT_TYPES.includes(input.eventType)) {
    throw new Error("INVALID_EVENT_TYPE");
  }

  const now = Date.now();
  const occurredAt = typeof input.occurredAt === "number" ? input.occurredAt : now;
  const payload: LedgerEventV2 = {
    id: "",
    landlordId: input.landlordId,
    propertyId: input.propertyId,
    unitId: input.unitId,
    tenantId: input.tenantId,
    leaseId: input.leaseId,
    paymentId: input.paymentId,
    eventType: input.eventType,
    title: input.title,
    summary: input.summary,
    amount: input.amount,
    currency: input.amount ? input.currency || "CAD" : undefined,
    occurredAt,
    createdAt: now,
    actor: input.actor || { type: "SYSTEM" },
    tags: input.tags || [],
    metadata: input.metadata || {},
    prevHash: null,
    hash: undefined,
    hashVersion: undefined,
  };

  try {
    const prevSnap = await db
      .collection(COLLECTION)
      .where("landlordId", "==", input.landlordId)
      .orderBy("occurredAt", "desc")
      .limit(1)
      .get();
    const prev = prevSnap.empty ? null : (prevSnap.docs[0].data() as LedgerEventV2);
    const prevHash = prev?.hash ?? null;
    const computedHash = computeLedgerEventHashV1({ ...payload, prevHash }, prevHash);
    payload.prevHash = prevHash;
    payload.hash = computedHash;
    payload.hashVersion = 1;
  } catch (err) {
    console.warn("[ledger-v2] hash computation failed (fail-open)", (err as any)?.message || err);
  }

  const ref = db.collection(COLLECTION).doc();
  await ref.set({ ...payload, id: ref.id });
  return { ...payload, id: ref.id };
}

interface ListParams {
  landlordId: string;
  limit?: number;
  cursor?: number;
  propertyId?: string;
  tenantId?: string;
  eventType?: string;
}

export async function listLedgerEventsV2(params: ListParams) {
  const {
    landlordId,
    limit = 50,
    cursor,
    propertyId,
    tenantId,
    eventType,
  } = params;

  let q: FirebaseFirestore.Query = db
    .collection(COLLECTION)
    .where("landlordId", "==", landlordId)
    .orderBy("occurredAt", "desc");

  if (cursor) {
    q = q.where("occurredAt", "<", cursor);
  }
  if (propertyId) {
    q = q.where("propertyId", "==", propertyId);
  }
  if (tenantId) {
    q = q.where("tenantId", "==", tenantId);
  }
  if (eventType) {
    q = q.where("eventType", "==", eventType);
  }

  const finalLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  q = q.limit(finalLimit);

  const snap = await q.get();
  const items = snap.docs.map((d) => d.data() as LedgerEventV2);
  const nextCursor = snap.size === finalLimit ? items[items.length - 1]?.occurredAt : undefined;
  return { items, nextCursor };
}

export async function getLedgerEventV2(id: string, landlordId: string) {
  const doc = await db.collection(COLLECTION).doc(id).get();
  if (!doc.exists) return null;
  const data = doc.data() as LedgerEventV2;
  if (data.landlordId !== landlordId) return null;
  return data;
}

export async function createLedgerNoteV2(input: {
  landlordId: string;
  title: string;
  summary?: string;
  propertyId?: string;
  tenantId?: string;
  occurredAt?: number;
  actor: LedgerEventV2["actor"];
}) {
  return emitLedgerEventV2({
    landlordId: input.landlordId,
    title: input.title,
    summary: input.summary,
    propertyId: input.propertyId,
    tenantId: input.tenantId,
    occurredAt: input.occurredAt,
    actor: input.actor,
    eventType: "NOTE_ADDED",
  });
}
