import crypto from "crypto";
import { db } from "../../firebase";
import type { PaymentExecutionStatus, PaymentProvider, PaymentPurpose } from "./paymentTypes";

export const PAYMENT_INTENTS_COLLECTION = "paymentIntents";

export const PAYMENT_INTENT_STATUSES = [
  "draft",
  "ready",
  "provider_session_created",
  "pending_provider_confirmation",
  "pending_settlement",
  "confirmed",
  "failed",
  "cancelled",
  "expired",
  "manual_review_required",
  "reconciled",
] as const;
export type PaymentIntentStatus = (typeof PAYMENT_INTENT_STATUSES)[number];

export const PAYMENT_INTENT_SOURCES = [
  "rent_payment_checkout",
  "manual_admin",
  "system_derived",
  "migration_placeholder",
] as const;
export type PaymentIntentSource = (typeof PAYMENT_INTENT_SOURCES)[number];

export type PaymentIntentRecord = {
  paymentIntentId: string;
  landlordId: string | null;
  tenantId?: string | null;
  propertyId: string | null;
  unitId?: string | null;
  leaseId?: string | null;
  rentPaymentId?: string | null;
  purpose: Extract<PaymentPurpose, "rent">;
  amountCents: number;
  currency: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  dueDate?: string | null;
  status: PaymentIntentStatus;
  provider?: PaymentProvider | null;
  providerSessionId?: string | null;
  providerPaymentId?: string | null;
  source: PaymentIntentSource;
  lifecycleState: "complete" | "requires_review";
  requiresReview: boolean;
  createdAt: string;
  updatedAt: string;
  metadataSummary?: Record<string, unknown> | null;
};

export type PaymentIntentUpsertInput = {
  landlordId?: string | null;
  tenantId?: string | null;
  propertyId?: string | null;
  unitId?: string | null;
  leaseId?: string | null;
  rentPaymentId?: string | null;
  purpose: Extract<PaymentPurpose, "rent">;
  amountCents: number;
  currency?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  dueDate?: string | null;
  source: PaymentIntentSource;
  provider?: PaymentProvider | null;
  providerSessionId?: string | null;
  providerPaymentId?: string | null;
  metadataSummary?: Record<string, unknown> | null;
  now?: string | null;
  firestore?: FirestoreLike;
};

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

function getFirestore(input?: { firestore?: FirestoreLike }): FirestoreLike {
  return input?.firestore || (db as unknown as FirestoreLike);
}

function asString(value: unknown, max = 500): string | null {
  const next = String(value ?? "").trim().slice(0, max);
  return next || null;
}

function normalizeCurrency(value: unknown): string {
  return String(value || "cad").trim().toLowerCase() || "cad";
}

function normalizeAmountCents(value: unknown): number {
  const next = Number(value);
  if (!Number.isFinite(next) || next < 0) return 0;
  return Math.round(next);
}

function toIsoDate(value: unknown): string | null {
  const raw = asString(value, 120);
  if (!raw) return null;
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

function nowIso(value?: string | null): string {
  return toIsoDate(value) || new Date().toISOString();
}

function cleanPart(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\/\\#?]+/g, "_")
    .replace(/[^a-z0-9_.:-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function stableHash(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 32);
}

function normalizeMetadataSummary(value: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  const safe: Record<string, unknown> = {};
  for (const [key, rawValue] of Object.entries(value).slice(0, 20)) {
    const safeKey = asString(key, 80);
    if (!safeKey) continue;
    if (rawValue == null || ["string", "number", "boolean"].includes(typeof rawValue)) {
      safe[safeKey] = rawValue;
    }
  }
  return Object.keys(safe).length ? safe : null;
}

function normalizeStatus(value: unknown): PaymentIntentStatus | null {
  const next = asString(value, 80) as PaymentIntentStatus | null;
  return next && (PAYMENT_INTENT_STATUSES as readonly string[]).includes(next) ? next : null;
}

function normalizeRecord(data: Record<string, unknown>, fallbackId: string): PaymentIntentRecord {
  const amountCents = normalizeAmountCents(data.amountCents);
  const status = normalizeStatus(data.status) || "manual_review_required";
  const requiresReview = data.requiresReview === true || status === "manual_review_required";
  return {
    paymentIntentId: asString(data.paymentIntentId, 240) || fallbackId,
    landlordId: asString(data.landlordId, 240),
    tenantId: asString(data.tenantId, 240),
    propertyId: asString(data.propertyId, 240),
    unitId: asString(data.unitId, 240),
    leaseId: asString(data.leaseId, 240),
    rentPaymentId: asString(data.rentPaymentId, 240),
    purpose: "rent",
    amountCents,
    currency: normalizeCurrency(data.currency),
    periodStart: toIsoDate(data.periodStart),
    periodEnd: toIsoDate(data.periodEnd),
    dueDate: toIsoDate(data.dueDate),
    status,
    provider: (asString(data.provider, 50) as PaymentProvider | null) || null,
    providerSessionId: asString(data.providerSessionId, 240),
    providerPaymentId: asString(data.providerPaymentId, 240),
    source: ((asString(data.source, 80) as PaymentIntentSource | null) || "system_derived") as PaymentIntentSource,
    lifecycleState: requiresReview ? "requires_review" : "complete",
    requiresReview,
    createdAt: toIsoDate(data.createdAt) || nowIso(),
    updatedAt: toIsoDate(data.updatedAt) || nowIso(),
    metadataSummary:
      data.metadataSummary && typeof data.metadataSummary === "object"
        ? normalizeMetadataSummary(data.metadataSummary as Record<string, unknown>)
        : null,
  };
}

function hasCompleteRentObligationKey(input: PaymentIntentUpsertInput): boolean {
  return Boolean(
    asString(input.landlordId, 240) &&
      asString(input.propertyId, 240) &&
      asString(input.leaseId, 240) &&
      asString(input.tenantId, 240) &&
      normalizeAmountCents(input.amountCents) > 0 &&
      normalizeCurrency(input.currency)
  );
}

export function buildPaymentIntentId(input: Partial<PaymentIntentUpsertInput>): string {
  const amountCents = normalizeAmountCents(input.amountCents);
  const currency = normalizeCurrency(input.currency);
  const purpose = asString(input.purpose, 40) || "rent";
  const keyParts = hasCompleteRentObligationKey({
    ...(input as PaymentIntentUpsertInput),
    purpose: "rent",
    source: input.source || "system_derived",
    amountCents,
    currency,
  })
    ? [
        "rent_obligation",
        input.landlordId,
        input.propertyId,
        input.unitId,
        input.leaseId,
        input.tenantId,
        purpose,
        toIsoDate(input.periodStart) || "",
        toIsoDate(input.periodEnd) || "",
        amountCents,
        currency,
      ]
    : ["rent_payment", input.rentPaymentId || input.leaseId || input.tenantId || "review_required", purpose, amountCents, currency];

  const seed = keyParts.map((part) => cleanPart(part)).join(":");
  return `pi_rent_${stableHash(seed)}`;
}

export async function getPaymentIntentById(input: {
  paymentIntentId: string;
  firestore?: FirestoreLike;
}): Promise<PaymentIntentRecord | null> {
  const paymentIntentId = asString(input.paymentIntentId, 240);
  if (!paymentIntentId) return null;
  const snap = await getFirestore(input).collection(PAYMENT_INTENTS_COLLECTION).doc(paymentIntentId).get();
  if (!snap.exists) return null;
  return normalizeRecord(snap.data() || {}, paymentIntentId);
}

export async function findPaymentIntentByRentPaymentId(input: {
  rentPaymentId: string;
  firestore?: FirestoreLike;
}): Promise<PaymentIntentRecord | null> {
  const rentPaymentId = asString(input.rentPaymentId, 240);
  if (!rentPaymentId) return null;
  const collection = getFirestore(input).collection(PAYMENT_INTENTS_COLLECTION);
  if (!collection.where) return null;
  const snap = await collection.where("rentPaymentId", "==", rentPaymentId).limit(1).get();
  if (snap.empty || !snap.docs?.[0]) return null;
  return normalizeRecord(snap.docs[0].data() || {}, snap.docs[0].id);
}

export async function upsertPaymentIntent(input: PaymentIntentUpsertInput): Promise<{
  paymentIntent: PaymentIntentRecord;
  created: boolean;
}> {
  const at = nowIso(input.now);
  const paymentIntentId = buildPaymentIntentId(input);
  const ref = getFirestore(input).collection(PAYMENT_INTENTS_COLLECTION).doc(paymentIntentId);
  const snap = await ref.get();
  const existing = snap.exists ? normalizeRecord(snap.data() || {}, paymentIntentId) : null;
  const requiresReview = !hasCompleteRentObligationKey(input);
  const status: PaymentIntentStatus = requiresReview ? "manual_review_required" : existing?.status || "ready";
  const next: PaymentIntentRecord = {
    paymentIntentId,
    landlordId: asString(input.landlordId, 240),
    tenantId: asString(input.tenantId, 240),
    propertyId: asString(input.propertyId, 240),
    unitId: asString(input.unitId, 240),
    leaseId: asString(input.leaseId, 240),
    rentPaymentId: asString(input.rentPaymentId, 240) || existing?.rentPaymentId || null,
    purpose: "rent",
    amountCents: normalizeAmountCents(input.amountCents),
    currency: normalizeCurrency(input.currency),
    periodStart: toIsoDate(input.periodStart),
    periodEnd: toIsoDate(input.periodEnd),
    dueDate: toIsoDate(input.dueDate),
    status,
    provider: input.provider || existing?.provider || null,
    providerSessionId: asString(input.providerSessionId, 240) || existing?.providerSessionId || null,
    providerPaymentId: asString(input.providerPaymentId, 240) || existing?.providerPaymentId || null,
    source: input.source,
    lifecycleState: requiresReview ? "requires_review" : "complete",
    requiresReview,
    createdAt: existing?.createdAt || at,
    updatedAt: at,
    metadataSummary: normalizeMetadataSummary(input.metadataSummary) || existing?.metadataSummary || null,
  };
  await ref.set(next, { merge: true });
  return { paymentIntent: next, created: !existing };
}

export async function linkPaymentIntentProviderReference(input: {
  paymentIntentId: string;
  provider: PaymentProvider;
  providerSessionId?: string | null;
  providerPaymentId?: string | null;
  status?: PaymentIntentStatus;
  now?: string | null;
  firestore?: FirestoreLike;
}): Promise<PaymentIntentRecord | null> {
  const paymentIntentId = asString(input.paymentIntentId, 240);
  if (!paymentIntentId) return null;
  const existing = await getPaymentIntentById({ paymentIntentId, firestore: input.firestore });
  if (!existing) return null;
  const at = nowIso(input.now);
  const patch = {
    provider: input.provider,
    providerSessionId: asString(input.providerSessionId, 240) || existing.providerSessionId || null,
    providerPaymentId: asString(input.providerPaymentId, 240) || existing.providerPaymentId || null,
    status: input.status || "provider_session_created",
    updatedAt: at,
  };
  await getFirestore(input).collection(PAYMENT_INTENTS_COLLECTION).doc(paymentIntentId).set(patch, { merge: true });
  return normalizeRecord({ ...existing, ...patch }, paymentIntentId);
}

export function mapProviderSignalToPaymentIntentStatus(status: PaymentExecutionStatus | null | undefined): PaymentIntentStatus {
  if (status === "provider_session_created") return "provider_session_created";
  if (status === "pending_provider_confirmation") return "pending_provider_confirmation";
  if (status === "pending_settlement" || status === "initiated") return "pending_settlement";
  if (status === "confirmed" || status === "reconciled") return "confirmed";
  if (status === "failed") return "failed";
  if (status === "cancelled") return "cancelled";
  if (status === "expired") return "expired";
  if (status === "mismatch" || status === "duplicate_risk" || status === "manual_review_required") {
    return "manual_review_required";
  }
  return "manual_review_required";
}

export async function updatePaymentIntentFromProviderSignal(input: {
  paymentIntentId?: string | null;
  rentPaymentId?: string | null;
  provider: PaymentProvider;
  providerSessionId?: string | null;
  providerPaymentId?: string | null;
  normalizedStatus?: PaymentExecutionStatus | null;
  now?: string | null;
  firestore?: FirestoreLike;
}): Promise<PaymentIntentRecord | null> {
  const fromId = input.paymentIntentId
    ? await getPaymentIntentById({ paymentIntentId: input.paymentIntentId, firestore: input.firestore })
    : null;
  const intent =
    fromId ||
    (input.rentPaymentId
      ? await findPaymentIntentByRentPaymentId({ rentPaymentId: input.rentPaymentId, firestore: input.firestore })
      : null);
  if (!intent) return null;
  return linkPaymentIntentProviderReference({
    paymentIntentId: intent.paymentIntentId,
    provider: input.provider,
    providerSessionId: input.providerSessionId,
    providerPaymentId: input.providerPaymentId,
    status: mapProviderSignalToPaymentIntentStatus(input.normalizedStatus),
    now: input.now,
    firestore: input.firestore,
  });
}

