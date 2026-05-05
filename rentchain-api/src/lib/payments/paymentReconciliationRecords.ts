import { db } from "../../config/firebase";
import type { NormalizedProviderPaymentEvent } from "./paymentProviderAdapter";
import type { PaymentReconciliationResult } from "./paymentReconciliation";
import type { PaymentExecutionStatus, PaymentProvider, PaymentPurpose } from "./paymentTypes";

export const PAYMENT_RECONCILIATION_RECORDS_COLLECTION = "paymentReconciliationRecords";

export type PaymentReconciliationRecord = {
  reconciliationId: string;
  provider: PaymentProvider;
  providerEventId: string;
  idempotencyKey: string;
  receiptId: string;
  subjectType?: string | null;
  subjectId?: string | null;
  paymentIntentId?: string | null;
  purpose?: PaymentPurpose | null;
  normalizedStatus?: PaymentExecutionStatus | null;
  rawStatus?: string | null;
  reconciliationStatus: PaymentReconciliationResult["reconciliationStatus"];
  reasons: string[];
  requiresManualReview: boolean;
  automationEligible: boolean;
  createdAt: string;
  updatedAt: string;
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

type UpsertPaymentReconciliationRecordInput = {
  idempotencyKey: string;
  receiptId: string;
  subjectType?: string | null;
  subjectId?: string | null;
  paymentIntentId?: string | null;
  purpose?: PaymentPurpose | null;
  providerSignal: NormalizedProviderPaymentEvent;
  reconciliation: PaymentReconciliationResult;
  now?: string | null;
  firestore?: FirestoreLike;
};

function nowIso(value?: string | null): string {
  const raw = String(value || "").trim();
  if (raw) return raw;
  return new Date().toISOString();
}

function cleanRecordPart(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\/\\#?]+/g, "_")
    .replace(/[^a-z0-9_.:-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeOptionalString(value: unknown, max = 500): string | null {
  const next = String(value || "").trim().slice(0, max);
  return next || null;
}

function getFirestore(input?: { firestore?: FirestoreLike }): FirestoreLike {
  return input?.firestore || (db as unknown as FirestoreLike);
}

function recordRef(reconciliationId: string, firestore?: FirestoreLike): FirestoreDocRef {
  return getFirestore({ firestore }).collection(PAYMENT_RECONCILIATION_RECORDS_COLLECTION).doc(reconciliationId);
}

function normalizeReasons(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 20);
}

function normalizeRecord(
  data: Record<string, unknown>,
  fallback: { reconciliationId: string; idempotencyKey: string; receiptId: string }
): PaymentReconciliationRecord {
  return {
    reconciliationId: normalizeOptionalString(data.reconciliationId, 300) || fallback.reconciliationId,
    provider: (normalizeOptionalString(data.provider, 50) || "stripe") as PaymentProvider,
    providerEventId: normalizeOptionalString(data.providerEventId, 300) || "event_missing",
    idempotencyKey: normalizeOptionalString(data.idempotencyKey, 500) || fallback.idempotencyKey,
    receiptId: normalizeOptionalString(data.receiptId, 300) || fallback.receiptId,
    subjectType: normalizeOptionalString(data.subjectType, 80),
    subjectId: normalizeOptionalString(data.subjectId, 300),
    paymentIntentId: normalizeOptionalString(data.paymentIntentId, 300),
    purpose: (normalizeOptionalString(data.purpose, 50) as PaymentPurpose | null) || null,
    normalizedStatus: (normalizeOptionalString(data.normalizedStatus, 80) as PaymentExecutionStatus | null) || null,
    rawStatus: normalizeOptionalString(data.rawStatus, 200),
    reconciliationStatus:
      (normalizeOptionalString(data.reconciliationStatus, 80) as PaymentReconciliationResult["reconciliationStatus"]) ||
      "manual_review_required",
    reasons: normalizeReasons(data.reasons),
    requiresManualReview: data.requiresManualReview === true,
    automationEligible: data.automationEligible === true,
    createdAt: normalizeOptionalString(data.createdAt, 80) || nowIso(),
    updatedAt: normalizeOptionalString(data.updatedAt, 80) || nowIso(),
  };
}

export function buildPaymentReconciliationRecordId(idempotencyKey: string): string {
  return cleanRecordPart(idempotencyKey || "provider_event:event_missing") || "provider_event:event_missing";
}

export async function upsertPaymentReconciliationRecord(
  input: UpsertPaymentReconciliationRecordInput
): Promise<PaymentReconciliationRecord> {
  const at = nowIso(input.now);
  const reconciliationId = buildPaymentReconciliationRecordId(input.idempotencyKey || input.receiptId);
  const ref = recordRef(reconciliationId, input.firestore);
  const snap = await ref.get();
  const existing = snap.exists
    ? normalizeRecord(snap.data() || {}, {
        reconciliationId,
        idempotencyKey: input.idempotencyKey,
        receiptId: input.receiptId,
      })
    : null;

  const record: PaymentReconciliationRecord = {
    reconciliationId,
    provider: input.providerSignal.provider,
    providerEventId: input.providerSignal.providerEventId || "event_missing",
    idempotencyKey: input.idempotencyKey,
    receiptId: input.receiptId,
    subjectType: normalizeOptionalString(input.subjectType, 80),
    subjectId: normalizeOptionalString(input.subjectId, 300),
    paymentIntentId: normalizeOptionalString(input.paymentIntentId, 300),
    purpose: input.purpose || input.providerSignal.purpose || null,
    normalizedStatus: input.providerSignal.normalizedStatus || null,
    rawStatus: input.providerSignal.rawStatus || null,
    reconciliationStatus: input.reconciliation.reconciliationStatus,
    reasons: normalizeReasons(input.reconciliation.reasons),
    requiresManualReview: input.reconciliation.requiresManualReview === true,
    automationEligible: input.reconciliation.automationEligible === true,
    createdAt: existing?.createdAt || at,
    updatedAt: at,
  };

  await ref.set(record, { merge: true });
  return record;
}
