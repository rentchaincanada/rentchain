import crypto from "crypto";
import { db } from "../firebase";
import type { PaymentObligationLedgerRow } from "../lib/payments/paymentObligationLedger";

export const LEASE_CREDIT_ALLOCATION_RECORDS_COLLECTION = "leaseCreditAllocationRecords";
export const CREDIT_ALLOCATION_STATE_STALE = "CREDIT_ALLOCATION_STATE_STALE";

export type LeaseCreditAllocationStatus = "active" | "reversed";
export type LeaseCreditAllocationSourceType = "lease_credit_allocation";

export type LeaseCreditAllocationRecord = {
  allocationId: string;
  landlordId: string;
  leaseId: string;
  propertyId: string | null;
  unitId: string | null;
  tenantId: string | null;
  obligationRowId: string;
  obligationKey: string;
  paymentIntentId: string | null;
  rentPaymentId: string | null;
  paymentDocumentId: string | null;
  allocationAmountCents: number;
  currency: string;
  sourceType: LeaseCreditAllocationSourceType;
  status: LeaseCreditAllocationStatus;
  createdAt: string;
  createdBy: string;
  createdByEmail: string | null;
  reason: string | null;
  note: string | null;
  beforeAvailableCreditCents: number;
  beforeOutstandingAmountCents: number;
  afterAvailableCreditCents: number;
  afterOutstandingAmountCents: number;
  previewFingerprint: string;
  idempotencyKey: string | null;
  reversedAt: string | null;
  reversedBy: string | null;
  reversedByEmail: string | null;
  reversalReason: string | null;
  reversalOfAllocationId: string | null;
  auditEventId: string | null;
  canonicalEventId: string | null;
};

export type LeaseCreditAllocationPreviewObligation = {
  obligationKey: string;
  obligationRowId: string;
  leaseId: string;
  propertyId: string | null;
  unitId: string | null;
  tenantId: string | null;
  paymentIntentId: string | null;
  rentPaymentId: string | null;
  paymentDocumentId: string | null;
  dueDate: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  expectedAmountCents: number;
  paidAmountCents: number;
  existingActiveAllocationAmountCents: number;
  outstandingAmountCents: number;
  currency: string;
  suggestedAllocationAmountCents: number;
  afterAvailableCreditCents: number;
  obligationOutstandingAfterCents: number;
};

export type LeaseCreditAllocationPreview = {
  landlordId: string;
  leaseId: string;
  sourceType: LeaseCreditAllocationSourceType;
  aggregateBalanceCents: number;
  sourceBalanceBeforeCents: number;
  grossAvailableCreditCents: number;
  activeAllocationAmountCents: number;
  availableCreditCents: number;
  totalOutstandingAmountCents: number;
  totalSuggestedAllocationAmountCents: number;
  remainingAvailableCreditCents: number;
  obligations: LeaseCreditAllocationPreviewObligation[];
  allowed: boolean;
  blockedReasons: string[];
  previewFingerprint: string;
};

export type LeaseCreditAllocationValidationErrorCode =
  | typeof CREDIT_ALLOCATION_STATE_STALE
  | "LEASE_CREDIT_ALLOCATION_FORBIDDEN"
  | "LEASE_CREDIT_ALLOCATION_OBLIGATION_NOT_FOUND"
  | "LEASE_CREDIT_ALLOCATION_AMOUNT_REQUIRED"
  | "LEASE_CREDIT_ALLOCATION_AMOUNT_EXCEEDS_AVAILABLE_CREDIT"
  | "LEASE_CREDIT_ALLOCATION_AMOUNT_EXCEEDS_OUTSTANDING"
  | "LEASE_CREDIT_ALLOCATION_NO_CREDIT"
  | "LEASE_CREDIT_ALLOCATION_NO_OUTSTANDING_OBLIGATION"
  | "LEASE_CREDIT_ALLOCATION_DUPLICATE_CONFLICT";

export type LeaseCreditAllocationValidationError = {
  code: LeaseCreditAllocationValidationErrorCode;
  message: string;
};

export type LeaseCreditAllocationValidationResult =
  | { ok: true; obligation: LeaseCreditAllocationPreviewObligation }
  | { ok: false; error: LeaseCreditAllocationValidationError };

export type ApplyLeaseCreditAllocationInput = {
  landlordId: string;
  leaseId: string;
  aggregateBalanceCents: number;
  obligationRows: PaymentObligationLedgerRow[];
  allocationRecords?: LeaseCreditAllocationRecord[];
  obligationKey: string;
  allocationAmountCents: number;
  expectedPreviewFingerprint: string;
  createdBy: string;
  createdByEmail?: string | null;
  reason?: string | null;
  note?: string | null;
  idempotencyKey?: string | null;
  now?: string | null;
  firestore?: FirestoreLike;
};

export type ApplyLeaseCreditAllocationResult =
  | {
      ok: true;
      record: LeaseCreditAllocationRecord;
      preview: LeaseCreditAllocationPreview;
      idempotentReplay: boolean;
    }
  | { ok: false; error: LeaseCreditAllocationValidationError; preview: LeaseCreditAllocationPreview };

export type ReverseLeaseCreditAllocationInput = {
  record: LeaseCreditAllocationRecord;
  reversedBy: string;
  reversedByEmail?: string | null;
  reversalReason: string;
  now?: string | null;
  firestore?: FirestoreLike;
};

type SnapshotLike<T = Record<string, unknown>> = {
  exists?: boolean;
  id?: string;
  data: () => T | undefined;
};

type DocumentRefLike<T = Record<string, unknown>> = {
  id?: string;
  get: () => Promise<SnapshotLike<T>>;
  create?: (data: T) => Promise<unknown>;
  set: (data: Partial<T> | T, options?: { merge?: boolean }) => Promise<unknown>;
};

type QueryLike<T = Record<string, unknown>> = {
  where?: (field: string, op: string, value: unknown) => QueryLike<T>;
  get: () => Promise<{ docs: Array<SnapshotLike<T> & { id: string }> }>;
};

type CollectionLike<T = Record<string, unknown>> = QueryLike<T> & {
  doc: (id: string) => DocumentRefLike<T>;
};

export type FirestoreLike = {
  collection: <T = Record<string, unknown>>(name: string) => CollectionLike<T>;
};

function firestoreDb(firestore?: FirestoreLike): FirestoreLike {
  return firestore || (db as unknown as FirestoreLike);
}

function cleanString(value: unknown, max = 500): string | null {
  const text = String(value ?? "").trim().slice(0, max);
  return text || null;
}

function cleanIdPart(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\/\\#?]+/g, "_")
    .replace(/[^a-z0-9_.:-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeAmountCents(value: unknown): number {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.round(amount);
}

function normalizeSignedCents(value: unknown): number {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount);
}

function normalizeCurrency(value: unknown): string {
  return cleanString(value, 16)?.toLowerCase() || "cad";
}

function normalizeDateToken(value: unknown): string {
  const raw = cleanString(value, 120);
  if (!raw) return "none";
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) return cleanIdPart(raw) || "none";
  return new Date(parsed).toISOString().slice(0, 10);
}

function nowIso(value?: string | null): string {
  const raw = cleanString(value, 120);
  if (!raw) return new Date().toISOString();
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
}

function stableHash(value: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 32);
}

function outstandingAmountCents(row: PaymentObligationLedgerRow): number {
  return Math.max(0, normalizeAmountCents(row.expectedAmountCents) - normalizeAmountCents(row.paidAmountCents));
}

function activeRecords(records: LeaseCreditAllocationRecord[] | null | undefined, landlordId: string, leaseId: string) {
  return (records || []).filter((record) => {
    return (
      record.status === "active" &&
      cleanString(record.landlordId, 240) === landlordId &&
      cleanString(record.leaseId, 240) === leaseId &&
      normalizeAmountCents(record.allocationAmountCents) > 0
    );
  });
}

export function buildLeaseCreditAllocationObligationKey(row: PaymentObligationLedgerRow): string {
  const leaseId = cleanIdPart(row.leaseId) || "lease_unknown";
  const expectedAmountCents = normalizeAmountCents(row.expectedAmountCents);
  const paymentIntentId = cleanIdPart(row.paymentIntentId);
  if (paymentIntentId) return `lease_credit_obligation:${leaseId}:payment_intent:${paymentIntentId}`;
  const rentPaymentId = cleanIdPart(row.rentPaymentId);
  if (rentPaymentId) return `lease_credit_obligation:${leaseId}:rent_payment:${rentPaymentId}`;
  const paymentDocumentId = cleanIdPart(row.paymentDocumentId);
  if (paymentDocumentId) return `lease_credit_obligation:${leaseId}:payment_document:${paymentDocumentId}`;
  return [
    "lease_credit_obligation",
    leaseId,
    "derived",
    normalizeDateToken(row.dueDate),
    normalizeDateToken(row.periodStart),
    normalizeDateToken(row.periodEnd),
    String(expectedAmountCents),
  ].join(":");
}

export function buildLeaseCreditAllocationPreview(input: {
  landlordId: string;
  leaseId: string;
  aggregateBalanceCents: number;
  obligationRows: PaymentObligationLedgerRow[];
  allocationRecords?: LeaseCreditAllocationRecord[];
}): LeaseCreditAllocationPreview {
  const landlordId = cleanString(input.landlordId, 240) || "";
  const leaseId = cleanString(input.leaseId, 240) || "";
  const aggregateBalanceCents = normalizeSignedCents(input.aggregateBalanceCents);
  const grossAvailableCreditCents = Math.max(0, -aggregateBalanceCents);
  const active = activeRecords(input.allocationRecords, landlordId, leaseId);
  const allocatedByObligationKey = new Map<string, number>();
  let activeAllocationAmountCents = 0;
  for (const record of active) {
    const amount = normalizeAmountCents(record.allocationAmountCents);
    activeAllocationAmountCents += amount;
    allocatedByObligationKey.set(record.obligationKey, (allocatedByObligationKey.get(record.obligationKey) || 0) + amount);
  }
  const availableCreditCents = Math.max(0, grossAvailableCreditCents - activeAllocationAmountCents);
  const obligationsBeforeSuggestion = (input.obligationRows || [])
    .filter((row) => cleanString(row.leaseId, 240) === leaseId)
    .map((row) => {
      const obligationKey = buildLeaseCreditAllocationObligationKey(row);
      const existingActiveAllocationAmountCents = allocatedByObligationKey.get(obligationKey) || 0;
      const outstandingBeforeAllocation = outstandingAmountCents(row);
      const outstandingAfterExistingAllocation = Math.max(0, outstandingBeforeAllocation - existingActiveAllocationAmountCents);
      return {
        obligationKey,
        obligationRowId: cleanString(row.rowId, 240) || obligationKey,
        leaseId,
        propertyId: cleanString(row.propertyId, 240),
        unitId: cleanString(row.unitId, 240),
        tenantId: cleanString(row.tenantId, 240),
        paymentIntentId: cleanString(row.paymentIntentId, 240),
        rentPaymentId: cleanString(row.rentPaymentId, 240),
        paymentDocumentId: cleanString(row.paymentDocumentId, 240),
        dueDate: cleanString(row.dueDate, 120),
        periodStart: cleanString(row.periodStart, 120),
        periodEnd: cleanString(row.periodEnd, 120),
        expectedAmountCents: normalizeAmountCents(row.expectedAmountCents),
        paidAmountCents: normalizeAmountCents(row.paidAmountCents),
        existingActiveAllocationAmountCents,
        outstandingAmountCents: outstandingAfterExistingAllocation,
        currency: normalizeCurrency(row.currency),
      };
    })
    .filter((row) => row.outstandingAmountCents > 0)
    .sort((a, b) => {
      const dueDiff = String(a.dueDate || a.periodStart || "").localeCompare(String(b.dueDate || b.periodStart || ""));
      if (dueDiff !== 0) return dueDiff;
      return a.obligationKey.localeCompare(b.obligationKey);
    });
  let remainingCreditCents = availableCreditCents;
  const obligations = obligationsBeforeSuggestion.map((row) => {
    const suggestedAllocationAmountCents = Math.min(remainingCreditCents, row.outstandingAmountCents);
    remainingCreditCents = Math.max(0, remainingCreditCents - suggestedAllocationAmountCents);
    return {
      ...row,
      suggestedAllocationAmountCents,
      afterAvailableCreditCents: remainingCreditCents,
      obligationOutstandingAfterCents: Math.max(0, row.outstandingAmountCents - suggestedAllocationAmountCents),
    };
  });

  const totalOutstandingAmountCents = obligations.reduce((sum, row) => sum + row.outstandingAmountCents, 0);
  const totalSuggestedAllocationAmountCents = obligations.reduce(
    (sum, row) => sum + row.suggestedAllocationAmountCents,
    0
  );
  const blockedReasons = [
    landlordId && leaseId ? null : "lease_scope_required",
    grossAvailableCreditCents > 0 ? null : "aggregate_balance_is_not_credit",
    availableCreditCents > 0 ? null : "available_credit_consumed_by_active_allocations",
    totalOutstandingAmountCents > 0 ? null : "no_outstanding_obligations",
  ].filter(Boolean) as string[];

  const fingerprintInput = {
    landlordId,
    leaseId,
    aggregateBalanceCents,
    grossAvailableCreditCents,
    activeAllocations: active
      .map((record) => ({
        allocationId: record.allocationId,
        obligationKey: record.obligationKey,
        allocationAmountCents: normalizeAmountCents(record.allocationAmountCents),
        status: record.status,
      }))
      .sort((a, b) => a.allocationId.localeCompare(b.allocationId)),
    obligations: obligations.map((row) => ({
      obligationKey: row.obligationKey,
      expectedAmountCents: row.expectedAmountCents,
      paidAmountCents: row.paidAmountCents,
      existingActiveAllocationAmountCents: row.existingActiveAllocationAmountCents,
      outstandingAmountCents: row.outstandingAmountCents,
      currency: row.currency,
      dueDate: row.dueDate,
      periodStart: row.periodStart,
      periodEnd: row.periodEnd,
    })),
  };

  return {
    landlordId,
    leaseId,
    sourceType: "lease_credit_allocation",
    aggregateBalanceCents,
    sourceBalanceBeforeCents: aggregateBalanceCents,
    grossAvailableCreditCents,
    activeAllocationAmountCents,
    availableCreditCents,
    totalOutstandingAmountCents,
    totalSuggestedAllocationAmountCents,
    remainingAvailableCreditCents: Math.max(0, availableCreditCents - totalSuggestedAllocationAmountCents),
    obligations,
    allowed: blockedReasons.length === 0,
    blockedReasons,
    previewFingerprint: `lease_credit_allocation_preview:${stableHash(fingerprintInput)}`,
  };
}

export function validateLeaseCreditAllocationRequest(input: {
  preview: LeaseCreditAllocationPreview;
  obligationKey: string;
  allocationAmountCents: number;
  expectedPreviewFingerprint?: string | null;
}): LeaseCreditAllocationValidationResult {
  const expectedPreviewFingerprint = cleanString(input.expectedPreviewFingerprint, 200);
  if (!expectedPreviewFingerprint || expectedPreviewFingerprint !== input.preview.previewFingerprint) {
    return {
      ok: false,
      error: {
        code: CREDIT_ALLOCATION_STATE_STALE,
        message: "Credit allocation preview is stale. Refresh the allocation state before applying credit.",
      },
    };
  }
  if (!input.preview.allowed) {
    const code =
      input.preview.grossAvailableCreditCents <= 0 || input.preview.availableCreditCents <= 0
        ? "LEASE_CREDIT_ALLOCATION_NO_CREDIT"
        : "LEASE_CREDIT_ALLOCATION_NO_OUTSTANDING_OBLIGATION";
    return { ok: false, error: { code, message: "Credit allocation is not currently allowed for this lease." } };
  }
  const obligationKey = cleanString(input.obligationKey, 500);
  const obligation = input.preview.obligations.find((row) => row.obligationKey === obligationKey);
  if (!obligation) {
    return {
      ok: false,
      error: {
        code: "LEASE_CREDIT_ALLOCATION_OBLIGATION_NOT_FOUND",
        message: "The selected obligation is not eligible for credit allocation.",
      },
    };
  }
  const allocationAmountCents = normalizeAmountCents(input.allocationAmountCents);
  if (allocationAmountCents <= 0) {
    return {
      ok: false,
      error: {
        code: "LEASE_CREDIT_ALLOCATION_AMOUNT_REQUIRED",
        message: "Allocation amount must be greater than zero.",
      },
    };
  }
  if (allocationAmountCents > input.preview.availableCreditCents) {
    return {
      ok: false,
      error: {
        code: "LEASE_CREDIT_ALLOCATION_AMOUNT_EXCEEDS_AVAILABLE_CREDIT",
        message: "Allocation amount cannot exceed available lease credit.",
      },
    };
  }
  if (allocationAmountCents > obligation.outstandingAmountCents) {
    return {
      ok: false,
      error: {
        code: "LEASE_CREDIT_ALLOCATION_AMOUNT_EXCEEDS_OUTSTANDING",
        message: "Allocation amount cannot exceed the selected obligation outstanding amount.",
      },
    };
  }
  return { ok: true, obligation };
}

export function buildLeaseCreditAllocationRecordId(input: {
  landlordId: string;
  leaseId: string;
  obligationKey: string;
  allocationAmountCents: number;
  idempotencyKey?: string | null;
  previewFingerprint?: string | null;
}): string {
  const idempotencyKey = cleanString(input.idempotencyKey, 500);
  const parts = idempotencyKey
    ? ["idempotency", input.landlordId, input.leaseId, idempotencyKey]
    : [
        "allocation",
        input.landlordId,
        input.leaseId,
        input.obligationKey,
        normalizeAmountCents(input.allocationAmountCents),
        input.previewFingerprint,
      ];
  return `lease_credit_allocation:${stableHash(parts)}`;
}

async function createAllocationRecord(record: LeaseCreditAllocationRecord, firestore?: FirestoreLike): Promise<void> {
  const ref = firestoreDb(firestore)
    .collection<LeaseCreditAllocationRecord>(LEASE_CREDIT_ALLOCATION_RECORDS_COLLECTION)
    .doc(record.allocationId);
  if (ref.create) {
    await ref.create(record);
    return;
  }
  const existing = await ref.get();
  if (existing.exists) throw new Error("lease_credit_allocation_record_exists");
  await ref.set(record, { merge: false });
}

async function patchAllocationRecord(
  allocationId: string,
  patch: Partial<LeaseCreditAllocationRecord>,
  firestore?: FirestoreLike
): Promise<void> {
  await firestoreDb(firestore)
    .collection<LeaseCreditAllocationRecord>(LEASE_CREDIT_ALLOCATION_RECORDS_COLLECTION)
    .doc(allocationId)
    .set(patch, { merge: true });
}

async function getAllocationRecord(
  allocationId: string,
  firestore?: FirestoreLike
): Promise<LeaseCreditAllocationRecord | null> {
  if (!firestore) return null;
  const snap = await firestoreDb(firestore)
    .collection<LeaseCreditAllocationRecord>(LEASE_CREDIT_ALLOCATION_RECORDS_COLLECTION)
    .doc(allocationId)
    .get();
  if (!snap.exists) return null;
  return snap.data() || null;
}

export async function listLeaseCreditAllocationRecords(input: {
  landlordId: string;
  leaseId: string;
  firestore?: FirestoreLike;
}): Promise<LeaseCreditAllocationRecord[]> {
  const landlordId = cleanString(input.landlordId, 240) || "";
  const leaseId = cleanString(input.leaseId, 240) || "";
  const collection = firestoreDb(input.firestore).collection<LeaseCreditAllocationRecord>(
    LEASE_CREDIT_ALLOCATION_RECORDS_COLLECTION
  );
  const query = collection.where ? collection.where("leaseId", "==", leaseId) : collection;
  const snap = await query.get();
  return (snap.docs || [])
    .map((doc) => doc.data())
    .filter((record): record is LeaseCreditAllocationRecord => {
      return cleanString(record?.landlordId, 240) === landlordId && cleanString(record?.leaseId, 240) === leaseId;
    });
}

export async function applyLeaseCreditAllocation(
  input: ApplyLeaseCreditAllocationInput
): Promise<ApplyLeaseCreditAllocationResult> {
  const allocationRecords = input.allocationRecords || [];
  const idempotencyKey = cleanString(input.idempotencyKey, 500);
  const requestedObligationKey = cleanString(input.obligationKey, 500) || "";
  const requestedAmountCents = normalizeAmountCents(input.allocationAmountCents);
  const preview = buildLeaseCreditAllocationPreview({
    landlordId: input.landlordId,
    leaseId: input.leaseId,
    aggregateBalanceCents: input.aggregateBalanceCents,
    obligationRows: input.obligationRows,
    allocationRecords,
  });
  if (idempotencyKey) {
    const existing = allocationRecords.find((record) => {
      return (
        record.idempotencyKey === idempotencyKey &&
        record.landlordId === preview.landlordId &&
        record.leaseId === preview.leaseId
      );
    });
    if (existing) {
      if (existing.obligationKey === requestedObligationKey && existing.allocationAmountCents === requestedAmountCents) {
        return { ok: true, record: existing, preview, idempotentReplay: true };
      }
      return {
        ok: false,
        error: {
          code: "LEASE_CREDIT_ALLOCATION_DUPLICATE_CONFLICT",
          message: "A credit allocation record already exists for this idempotency scope.",
        },
        preview,
      };
    }
  }
  const validation = validateLeaseCreditAllocationRequest({
    preview,
    obligationKey: input.obligationKey,
    allocationAmountCents: input.allocationAmountCents,
    expectedPreviewFingerprint: input.expectedPreviewFingerprint,
  });
  if (!validation.ok) return { ok: false, error: validation.error, preview };

  const amount = requestedAmountCents;
  const obligation = validation.obligation;
  const allocationId = buildLeaseCreditAllocationRecordId({
    landlordId: preview.landlordId,
    leaseId: preview.leaseId,
    obligationKey: obligation.obligationKey,
    allocationAmountCents: amount,
    idempotencyKey,
    previewFingerprint: preview.previewFingerprint,
  });
  const conflicting = allocationRecords.find((record) => record.allocationId === allocationId);
  if (conflicting) {
    if (
      idempotencyKey &&
      conflicting.idempotencyKey === idempotencyKey &&
      conflicting.obligationKey === obligation.obligationKey &&
      conflicting.allocationAmountCents === amount
    ) {
      return { ok: true, record: conflicting, preview, idempotentReplay: true };
    }
    return {
      ok: false,
      error: {
        code: "LEASE_CREDIT_ALLOCATION_DUPLICATE_CONFLICT",
        message: "A credit allocation record already exists for this idempotency scope.",
      },
      preview,
    };
  }
  const stored = await getAllocationRecord(allocationId, input.firestore);
  if (stored) {
    if (
      idempotencyKey &&
      stored.idempotencyKey === idempotencyKey &&
      stored.landlordId === preview.landlordId &&
      stored.leaseId === preview.leaseId &&
      stored.obligationKey === obligation.obligationKey &&
      stored.allocationAmountCents === amount
    ) {
      return { ok: true, record: stored, preview, idempotentReplay: true };
    }
    return {
      ok: false,
      error: {
        code: "LEASE_CREDIT_ALLOCATION_DUPLICATE_CONFLICT",
        message: "A credit allocation record already exists for this idempotency scope.",
      },
      preview,
    };
  }

  const at = nowIso(input.now);
  const record: LeaseCreditAllocationRecord = {
    allocationId,
    landlordId: preview.landlordId,
    leaseId: preview.leaseId,
    propertyId: obligation.propertyId,
    unitId: obligation.unitId,
    tenantId: obligation.tenantId,
    obligationRowId: obligation.obligationRowId,
    obligationKey: obligation.obligationKey,
    paymentIntentId: obligation.paymentIntentId,
    rentPaymentId: obligation.rentPaymentId,
    paymentDocumentId: obligation.paymentDocumentId,
    allocationAmountCents: amount,
    currency: obligation.currency,
    sourceType: "lease_credit_allocation",
    status: "active",
    createdAt: at,
    createdBy: cleanString(input.createdBy, 240) || "system",
    createdByEmail: cleanString(input.createdByEmail, 320),
    reason: cleanString(input.reason, 500) || "operator_credit_allocation",
    note: cleanString(input.note, 1000),
    beforeAvailableCreditCents: preview.availableCreditCents,
    beforeOutstandingAmountCents: obligation.outstandingAmountCents,
    afterAvailableCreditCents: Math.max(0, preview.availableCreditCents - amount),
    afterOutstandingAmountCents: Math.max(0, obligation.outstandingAmountCents - amount),
    previewFingerprint: preview.previewFingerprint,
    idempotencyKey,
    reversedAt: null,
    reversedBy: null,
    reversedByEmail: null,
    reversalReason: null,
    reversalOfAllocationId: null,
    auditEventId: null,
    canonicalEventId: null,
  };

  if (input.firestore) await createAllocationRecord(record, input.firestore);
  return { ok: true, record, preview, idempotentReplay: false };
}

export async function reverseLeaseCreditAllocation(
  input: ReverseLeaseCreditAllocationInput
): Promise<LeaseCreditAllocationRecord> {
  if (input.record.status !== "active") {
    throw new Error("lease_credit_allocation_not_active");
  }
  const reversedAt = nowIso(input.now);
  const reversed: LeaseCreditAllocationRecord = {
    ...input.record,
    status: "reversed",
    reversedAt,
    reversedBy: cleanString(input.reversedBy, 240) || "system",
    reversedByEmail: cleanString(input.reversedByEmail, 320),
    reversalReason: cleanString(input.reversalReason, 1000) || "operator_reversal",
  };
  if (input.firestore) {
    await patchAllocationRecord(
      input.record.allocationId,
      {
        status: "reversed",
        reversedAt: reversed.reversedAt,
        reversedBy: reversed.reversedBy,
        reversedByEmail: reversed.reversedByEmail,
        reversalReason: reversed.reversalReason,
      },
      input.firestore
    );
  }
  return reversed;
}
