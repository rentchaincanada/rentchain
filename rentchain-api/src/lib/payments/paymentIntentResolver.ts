import { db } from "../../firebase";
import {
  buildPaymentIntentId,
  findPaymentIntentByRentPaymentId,
  getPaymentIntentById,
  PAYMENT_INTENTS_COLLECTION,
  type PaymentIntentRecord,
  type PaymentIntentUpsertInput,
} from "./paymentIntents";

type FirestoreDocRef = {
  get(): Promise<{ exists: boolean; data(): Record<string, unknown> | undefined }>;
  set(payload: Record<string, unknown>, options?: { merge?: boolean }): Promise<void>;
};

type FirestoreCollectionRef = {
  doc(id: string): FirestoreDocRef;
  where?(
    field: string,
    op: string,
    value: unknown
  ): {
    limit(count: number): { get(): Promise<{ empty: boolean; docs: Array<{ id: string; data(): Record<string, unknown> | undefined }> }> };
    get?(): Promise<{ empty: boolean; docs: Array<{ id: string; data(): Record<string, unknown> | undefined }> }>;
  };
};

type FirestoreLike = {
  collection(name: string): FirestoreCollectionRef;
};

export type PaymentIntentLeaseContext = Partial<
  Pick<PaymentIntentUpsertInput, "landlordId" | "tenantId" | "propertyId" | "unitId" | "leaseId" | "amountCents" | "currency" | "periodStart" | "periodEnd">
>;

function getFirestore(input?: { firestore?: FirestoreLike }): FirestoreLike {
  return input?.firestore || (db as unknown as FirestoreLike);
}

function asString(value: unknown, max = 500): string | null {
  const next = String(value ?? "").trim().slice(0, max);
  return next || null;
}

function normalizeRecord(data: Record<string, unknown>, fallbackId: string): PaymentIntentRecord {
  return {
    paymentIntentId: asString(data.paymentIntentId, 240) || fallbackId,
    landlordId: asString(data.landlordId, 240),
    tenantId: asString(data.tenantId, 240),
    propertyId: asString(data.propertyId, 240),
    unitId: asString(data.unitId, 240),
    leaseId: asString(data.leaseId, 240),
    rentPaymentId: asString(data.rentPaymentId, 240),
    purpose: "rent",
    amountCents: Math.max(0, Math.round(Number(data.amountCents || 0))),
    currency: String(data.currency || "cad").trim().toLowerCase() || "cad",
    periodStart: asString(data.periodStart, 120),
    periodEnd: asString(data.periodEnd, 120),
    dueDate: asString(data.dueDate, 120),
    status: (asString(data.status, 80) as PaymentIntentRecord["status"]) || "manual_review_required",
    provider: (asString(data.provider, 50) as PaymentIntentRecord["provider"]) || null,
    providerSessionId: asString(data.providerSessionId, 240),
    providerPaymentId: asString(data.providerPaymentId, 240),
    source: (asString(data.source, 80) as PaymentIntentRecord["source"]) || "system_derived",
    lifecycleState: data.lifecycleState === "complete" ? "complete" : "requires_review",
    requiresReview: data.requiresReview === true,
    createdAt: asString(data.createdAt, 120) || new Date(0).toISOString(),
    updatedAt: asString(data.updatedAt, 120) || new Date(0).toISOString(),
    metadataSummary:
      data.metadataSummary && typeof data.metadataSummary === "object"
        ? (data.metadataSummary as Record<string, unknown>)
        : null,
  };
}

function metadataValue(metadata: unknown, key: string): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  return asString((metadata as Record<string, unknown>)[key], 240);
}

function matchesContext(intent: PaymentIntentRecord, context: PaymentIntentLeaseContext): boolean {
  const checks: Array<[unknown, unknown]> = [
    [context.landlordId, intent.landlordId],
    [context.tenantId, intent.tenantId],
    [context.propertyId, intent.propertyId],
    [context.unitId, intent.unitId],
    [context.leaseId, intent.leaseId],
  ];
  for (const [expected, actual] of checks) {
    const normalizedExpected = asString(expected, 240);
    if (normalizedExpected && normalizedExpected !== asString(actual, 240)) return false;
  }
  if (typeof context.amountCents === "number" && Number.isFinite(context.amountCents)) {
    if (Math.round(context.amountCents) !== intent.amountCents) return false;
  }
  return true;
}

export async function resolvePaymentIntentByMetadata(input: {
  metadata?: unknown;
  firestore?: FirestoreLike;
}): Promise<PaymentIntentRecord | null> {
  const paymentIntentId = metadataValue(input.metadata, "paymentIntentId");
  if (paymentIntentId) {
    const byId = await getPaymentIntentById({ paymentIntentId, firestore: input.firestore });
    if (byId) return byId;
  }

  const rentPaymentId = metadataValue(input.metadata, "rentPaymentId");
  if (rentPaymentId) {
    return findPaymentIntentByRentPaymentId({ rentPaymentId, firestore: input.firestore });
  }

  return null;
}

export async function resolvePaymentIntentByRentPaymentId(input: {
  rentPaymentId?: string | null;
  firestore?: FirestoreLike;
}): Promise<PaymentIntentRecord | null> {
  const rentPaymentId = asString(input.rentPaymentId, 240);
  if (!rentPaymentId) return null;
  return findPaymentIntentByRentPaymentId({ rentPaymentId, firestore: input.firestore });
}

export async function resolvePaymentIntentByLeaseContext(input: {
  context: PaymentIntentLeaseContext;
  firestore?: FirestoreLike;
}): Promise<PaymentIntentRecord | null> {
  const context = input.context || {};
  const leaseId = asString(context.leaseId, 240);
  if (!leaseId) return null;

  if (
    asString(context.landlordId, 240) &&
    asString(context.propertyId, 240) &&
    asString(context.tenantId, 240) &&
    typeof context.amountCents === "number"
  ) {
    const expectedId = buildPaymentIntentId({
      ...context,
      purpose: "rent",
      source: "system_derived",
    });
    const exact = await getPaymentIntentById({ paymentIntentId: expectedId, firestore: input.firestore });
    if (exact) return exact;
  }

  const collection = getFirestore(input).collection(PAYMENT_INTENTS_COLLECTION);
  if (!collection.where) return null;
  const snap = await collection.where("leaseId", "==", leaseId).limit(20).get();
  if (snap.empty) return null;
  const candidates = (snap.docs || []).map((doc) => normalizeRecord(doc.data() || {}, doc.id));
  return candidates.find((intent) => matchesContext(intent, context)) || candidates[0] || null;
}
