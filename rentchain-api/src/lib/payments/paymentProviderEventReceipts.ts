import { db } from "../../config/firebase";
import type { PaymentExecutionStatus, PaymentProvider, PaymentPurpose } from "./paymentTypes";

export const PAYMENT_PROVIDER_EVENT_RECEIPTS_COLLECTION = "paymentProviderEventReceipts";

export const PAYMENT_PROVIDER_EVENT_RECEIPT_STATUSES = [
  "received",
  "processing",
  "processed",
  "ignored_duplicate",
  "failed",
  "manual_review_required",
] as const;

export type PaymentProviderEventReceiptStatus = (typeof PAYMENT_PROVIDER_EVENT_RECEIPT_STATUSES)[number];

export type PaymentProviderEventReceipt = {
  receiptId: string;
  idempotencyKey: string;
  provider: PaymentProvider;
  providerEventId: string;
  purpose?: PaymentPurpose | null;
  subjectType?: string | null;
  subjectId?: string | null;
  status: PaymentProviderEventReceiptStatus;
  firstReceivedAt: string;
  lastSeenAt: string;
  processedAt?: string | null;
  failedAt?: string | null;
  failureReason?: string | null;
  duplicateCount: number;
  normalizedStatus?: PaymentExecutionStatus | null;
  rawStatus?: string | null;
  metadataSummary?: Record<string, unknown> | null;
};

type FirestoreDocRef = {
  get(): Promise<{ exists: boolean; data(): Record<string, unknown> | undefined }>;
  set(payload: Record<string, unknown>, options?: { merge?: boolean }): Promise<void>;
};

type FirestoreLike = {
  collection(name: string): {
    doc(id: string): FirestoreDocRef;
  };
};

type ReceiptWriteInput = {
  idempotencyKey: string;
  provider: PaymentProvider;
  providerEventId: string;
  purpose?: PaymentPurpose | null;
  subjectType?: string | null;
  subjectId?: string | null;
  normalizedStatus?: PaymentExecutionStatus | null;
  rawStatus?: string | null;
  metadata?: Record<string, unknown> | null;
  now?: string | null;
  firestore?: FirestoreLike;
};

type ReceiptStatusInput = {
  receiptId: string;
  now?: string | null;
  failureReason?: string | null;
  firestore?: FirestoreLike;
};

export type ProviderEventReceiptWriteResult = {
  receiptId: string;
  isDuplicate: boolean;
  receipt: PaymentProviderEventReceipt;
  previousReceipt?: PaymentProviderEventReceipt | null;
};

function nowIso(value?: string | null): string {
  const raw = String(value || "").trim();
  if (raw) return raw;
  return new Date().toISOString();
}

function cleanReceiptPart(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\/\\#?]+/g, "_")
    .replace(/[^a-z0-9_.:-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function asPositiveInteger(value: unknown): number {
  const next = Number(value);
  if (!Number.isFinite(next) || next < 0) return 0;
  return Math.floor(next);
}

function normalizeOptionalString(value: unknown, max = 500): string | null {
  const next = String(value || "").trim().slice(0, max);
  return next || null;
}

function getFirestore(input?: { firestore?: FirestoreLike }): FirestoreLike {
  return input?.firestore || (db as unknown as FirestoreLike);
}

function receiptRef(receiptId: string, firestore?: FirestoreLike): FirestoreDocRef {
  return getFirestore({ firestore }).collection(PAYMENT_PROVIDER_EVENT_RECEIPTS_COLLECTION).doc(receiptId);
}

function normalizeMetadataSummary(metadata: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!metadata || typeof metadata !== "object") return null;
  const keys = Object.keys(metadata)
    .map((key) => String(key || "").trim())
    .filter(Boolean)
    .sort();
  if (keys.length === 0) return null;
  return { keys };
}

function normalizeReceipt(data: Record<string, unknown>, fallback: { receiptId: string; idempotencyKey: string }): PaymentProviderEventReceipt {
  return {
    receiptId: normalizeOptionalString(data.receiptId, 300) || fallback.receiptId,
    idempotencyKey: normalizeOptionalString(data.idempotencyKey, 500) || fallback.idempotencyKey,
    provider: (normalizeOptionalString(data.provider, 50) || "stripe") as PaymentProvider,
    providerEventId: normalizeOptionalString(data.providerEventId, 300) || "event_missing",
    purpose: (normalizeOptionalString(data.purpose, 50) as PaymentPurpose | null) || null,
    subjectType: normalizeOptionalString(data.subjectType, 80),
    subjectId: normalizeOptionalString(data.subjectId, 300),
    status: (normalizeOptionalString(data.status, 80) || "received") as PaymentProviderEventReceiptStatus,
    firstReceivedAt: normalizeOptionalString(data.firstReceivedAt, 80) || nowIso(),
    lastSeenAt: normalizeOptionalString(data.lastSeenAt, 80) || nowIso(),
    processedAt: normalizeOptionalString(data.processedAt, 80),
    failedAt: normalizeOptionalString(data.failedAt, 80),
    failureReason: normalizeOptionalString(data.failureReason, 500),
    duplicateCount: asPositiveInteger(data.duplicateCount),
    normalizedStatus: (normalizeOptionalString(data.normalizedStatus, 80) as PaymentExecutionStatus | null) || null,
    rawStatus: normalizeOptionalString(data.rawStatus, 200),
    metadataSummary:
      data.metadataSummary && typeof data.metadataSummary === "object"
        ? (data.metadataSummary as Record<string, unknown>)
        : null,
  };
}

export function buildProviderEventReceiptId(idempotencyKey: string): string {
  return cleanReceiptPart(idempotencyKey || "provider_event:event_missing") || "provider_event:event_missing";
}

export function serializeProviderEventReceiptSummary(receipt: PaymentProviderEventReceipt): Record<string, unknown> {
  return {
    receiptId: receipt.receiptId,
    idempotencyKey: receipt.idempotencyKey,
    provider: receipt.provider,
    providerEventId: receipt.providerEventId,
    purpose: receipt.purpose || null,
    subjectType: receipt.subjectType || null,
    subjectId: receipt.subjectId || null,
    status: receipt.status,
    duplicateCount: receipt.duplicateCount,
    normalizedStatus: receipt.normalizedStatus || null,
    rawStatus: receipt.rawStatus || null,
  };
}

export async function markProviderEventReceived(input: ReceiptWriteInput): Promise<ProviderEventReceiptWriteResult> {
  const at = nowIso(input.now);
  const receiptId = buildProviderEventReceiptId(input.idempotencyKey);
  const ref = receiptRef(receiptId, input.firestore);
  const snap = await ref.get();
  const metadataSummary = normalizeMetadataSummary(input.metadata);

  if (snap.exists) {
    const existing = normalizeReceipt(snap.data() || {}, { receiptId, idempotencyKey: input.idempotencyKey });
    const duplicateCount = existing.duplicateCount + 1;
    const next: PaymentProviderEventReceipt = {
      ...existing,
      status: "ignored_duplicate",
      lastSeenAt: at,
      duplicateCount,
      normalizedStatus: input.normalizedStatus || existing.normalizedStatus || null,
      rawStatus: input.rawStatus || existing.rawStatus || null,
      metadataSummary: metadataSummary || existing.metadataSummary || null,
    };
    await ref.set(next, { merge: true });
    return { receiptId, isDuplicate: true, receipt: next, previousReceipt: existing };
  }

  const receipt: PaymentProviderEventReceipt = {
    receiptId,
    idempotencyKey: input.idempotencyKey,
    provider: input.provider,
    providerEventId: input.providerEventId || "event_missing",
    purpose: input.purpose || null,
    subjectType: normalizeOptionalString(input.subjectType, 80),
    subjectId: normalizeOptionalString(input.subjectId, 300),
    status: "received",
    firstReceivedAt: at,
    lastSeenAt: at,
    processedAt: null,
    failedAt: null,
    failureReason: null,
    duplicateCount: 0,
    normalizedStatus: input.normalizedStatus || null,
    rawStatus: input.rawStatus || null,
    metadataSummary,
  };
  await ref.set(receipt, { merge: true });
  return { receiptId, isDuplicate: false, receipt, previousReceipt: null };
}

async function markProviderEventStatus(
  input: ReceiptStatusInput & { status: PaymentProviderEventReceiptStatus }
): Promise<PaymentProviderEventReceipt> {
  const at = nowIso(input.now);
  const ref = receiptRef(input.receiptId, input.firestore);
  const snap = await ref.get();
  const existing = normalizeReceipt(snap.data() || {}, {
    receiptId: input.receiptId,
    idempotencyKey: input.receiptId,
  });
  const patch: Record<string, unknown> = {
    status: input.status,
    lastSeenAt: at,
  };
  if (input.status === "processed") {
    patch.processedAt = at;
    patch.failureReason = null;
  }
  if (input.status === "failed") {
    patch.failedAt = at;
    patch.failureReason = normalizeOptionalString(input.failureReason, 500) || "provider_event_processing_failed";
  }
  if (input.status === "manual_review_required") {
    patch.failureReason = normalizeOptionalString(input.failureReason, 500) || "manual_review_required";
  }
  await ref.set(patch, { merge: true });
  return normalizeReceipt({ ...existing, ...patch }, { receiptId: input.receiptId, idempotencyKey: existing.idempotencyKey });
}

export function markProviderEventProcessing(input: ReceiptStatusInput): Promise<PaymentProviderEventReceipt> {
  return markProviderEventStatus({ ...input, status: "processing" });
}

export function markProviderEventProcessed(input: ReceiptStatusInput): Promise<PaymentProviderEventReceipt> {
  return markProviderEventStatus({ ...input, status: "processed" });
}

export function markProviderEventIgnoredDuplicate(input: ReceiptStatusInput): Promise<PaymentProviderEventReceipt> {
  return markProviderEventStatus({ ...input, status: "ignored_duplicate" });
}

export function markProviderEventFailed(input: ReceiptStatusInput): Promise<PaymentProviderEventReceipt> {
  return markProviderEventStatus({ ...input, status: "failed" });
}

export function markProviderEventManualReviewRequired(input: ReceiptStatusInput): Promise<PaymentProviderEventReceipt> {
  return markProviderEventStatus({ ...input, status: "manual_review_required" });
}
